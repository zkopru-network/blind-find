import * as http from "http";
import { Keypair, PubKey, Signature } from "maci-crypto";
import { AddressInfo } from "ws";

import { logger } from "./logger";
import { getCounterSignHashedData, HubConnectionRegistry, HubRegistry, signMsg, THubConnectionObj, verifySignedMsg } from ".";
import {
  RequestFailed,
  DatabaseCorrupted,
  HubRegistryNotFound
} from "./exceptions";
import {
  JoinReq,
  JoinResp,
  RequestSearchMessage,
  SearchMessage0,
  SearchMessage1,
  SearchMessage2,
  SearchMessage3,
  msgType, ProofSaltedConnectionReq, ProofSaltedConnectionResp, PROOF_SALTED_CONNECTION_RESP_REJECT, PROOF_SALTED_CONNECTION_RESP_ACCEPT, SEARCH_MSG_0_IS_END, SEARCH_MSG_0_IS_NOT_END
} from "./serialization";
import { TLV, Short } from "./smp/serialization";
import { bigIntToNumber } from "./smp/utils";
import {
  BaseServer,
  connect,
  IIPRateLimiter,
  TokenBucketRateLimiter,
  TRateLimitParams,
  IWebSocketReadWriter, relay
} from "./websocket";
import { TIMEOUT, MAXIMUM_TRIALS, TIMEOUT_LARGE } from "./configs";
import { THubRegistryObj } from "./";
import { SMPStateMachine } from "./smp";
import { getPubkeyB64Short, hashPointToScalar, isPubkeySame } from "./utils";
import { IAtomicDB, MerkleProof } from "./interfaces";
import { genProofOfSMP, genProofSaltedConnection, parseProofSaltedConnectionPublicSignals, TProof, verifyProofSaltedConnection } from "./circuits";
import { IDBMap, DBMap } from "./db";
import { SMPState1, SMPState2 } from "./smp/state";
import {
  Point,
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "./smp/v4/serialization";
import { BabyJubPoint } from "./smp/v4/babyJub";

type TUserRegistry = { userSig: Signature; hubSig: Signature };
type TSMPResult = {
  a3: BigInt;
  pa: BabyJubPoint;
  ph: BabyJubPoint;
  rh: BabyJubPoint;
  proofOfSMP: TProof;
};

interface IMapPubkeyStore<T extends Object> extends AsyncIterable<[PubKey, T]> {
  get(pubkey: PubKey): Promise<T | undefined>;
  set(pubkey: PubKey, registry: T): Promise<void>;
  getLength(): Promise<number>;
  remove(pubkey: PubKey): Promise<void>;
  removeAll(): Promise<void>;
}

class MapPubkeyStore<T extends Object> implements IMapPubkeyStore<T> {
  private mapStore: IDBMap<T>;
  maxKeyLength = Point.size * 2;

  constructor(prefix: string, db: IAtomicDB) {
    this.mapStore = new DBMap<T>(prefix, db, this.maxKeyLength);
  }

  async getLength() {
    return await this.mapStore.getLength();
  }

  async *[Symbol.asyncIterator](){
    for await (const obj of this.mapStore) {
      const pubkey = this.decodePubkey(obj.key);
      yield [pubkey, obj.value] as [PubKey, T];
    }
  }

  async getAll(): Promise<Array<[PubKey, T]>> {
    const ret: Array<[PubKey, T]> = [];
    for await (const i of this) {
      ret.push(i);
    }
    return ret;
  }

  private encodePubkey(pubkey: PubKey): string {
    const bytes = new Point(pubkey).serialize();
    const key = Buffer.from(bytes).toString("hex");
    if (key.length > this.maxKeyLength) {
      throw new Error(
        `key length is larger than maxKeyLength: key.length=${key.length}, maxKeyLength=${this.maxKeyLength}`
      );
    }
    return key;
  }

  private decodePubkey(pubkeyHex: string): PubKey {
    const bytesFromString = new Uint8Array(Buffer.from(pubkeyHex, "hex"));
    return Point.deserialize(bytesFromString).point;
  }

  async get(pubkey: PubKey) {
    const mapKey = this.encodePubkey(pubkey);
    return await this.mapStore.get(mapKey);
  }

  async set(pubkey: PubKey, registry: T) {
    const mapKey = this.encodePubkey(pubkey);
    await this.mapStore.set(mapKey, registry);
  }

  async remove(pubkey: PubKey) {
    const mapKey = this.encodePubkey(pubkey);
    await this.mapStore.del(mapKey);
  }

  async removeAll() {
    await this.mapStore.clear();
  }
}

const USER_STORE_PREFIX = "blind-find-hub-users";
/**
 * `UserStore` stores the mapping from `Pubkey` to `TUserRegistry`.
 */
export class UserStore extends MapPubkeyStore<TUserRegistry> {
  constructor(db: IAtomicDB) {
    super(USER_STORE_PREFIX, db);
  }
}

export type THubRegistryWithProof = {
  hubRegistry: THubRegistryObj;
  merkleProof: MerkleProof;
};

const REGISTRY_STORE_PREFIX = "blind-find-hub-registry";
/**
 * `RegistryStore` stores the mapping from `adminAddress` to `TUserRegistry`.
 */
class RegistryStore {
  private dbMap: IDBMap<THubRegistryWithProof>;
  constructor(private readonly adminAddress: BigInt, db: IAtomicDB) {
    this.dbMap = new DBMap<THubRegistryWithProof>(REGISTRY_STORE_PREFIX, db, this.getRegistryKey().length);
  }

  private getRegistryKey(): string {
    return "key";
  }

  async get(): Promise<THubRegistryWithProof> {
    const e: THubRegistryWithProof | undefined = await this.dbMap.get(
      this.getRegistryKey()
    );
    if (e === undefined) {
      throw new HubRegistryNotFound();
    }
    if (this.adminAddress !== e.hubRegistry.adminAddress) {
      throw new DatabaseCorrupted(
        `adminAddress mismatches: this.adminAddress=${this.adminAddress}, ` +
          `e.registry.adminAddress = ${e.hubRegistry.adminAddress}`
      );
    }
    return e;
  }

  async set(e: THubRegistryWithProof) {
    await this.dbMap.set(this.getRegistryKey(), e);
  }
}

const getIPFromHTTPRequest = (request: http.IncomingMessage): string => {
  return (request.connection.address() as AddressInfo).address;
}

type TTCPAddress = {
  host: string;
  port: number;
}

export type THubConnectionWithProof = {
  hubConnection: THubConnectionObj;
  merkleProof: MerkleProof;
  address: TTCPAddress;
}

const CONNECTION_REGISTRY_STORE_PREFIX = "blind-find-hub-connection-registry";
/**
 * `HubConnectionRegistryStore` stores the mapping from `targetHubPubkey` to `THubConnectionRegistry`.
 */
export class HubConnectionRegistryStore extends MapPubkeyStore<THubConnectionWithProof> {
  constructor(db: IAtomicDB) {
    super(CONNECTION_REGISTRY_STORE_PREFIX, db);
  }
}

export type THubRateLimit = {
  global: TRateLimitParams;
  join: TRateLimitParams;
  search: TRateLimitParams;
};

// TODO: Probably we can use `close.code` to indicate the reason why a socket is closed by
//  the server.
//  Ref: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
/**
 * `HubServer` is run by Hubs. The server receives requests and send the corresponding
 *  response to the users.
 */
export class HubServer extends BaseServer {
  name: string;
  userStore: UserStore;
  registryStore: RegistryStore;
  connectionRegistryStore: HubConnectionRegistryStore;

  joinRateLimiter: IIPRateLimiter;
  searchRateLimiter: IIPRateLimiter;
  globalRateLimiter: IIPRateLimiter;

  hubRegistryWithProof?: THubRegistryWithProof;

  constructor(
    readonly keypair: Keypair,
    readonly adminAddress: BigInt,
    rateLimit: THubRateLimit,
    db: IAtomicDB,
    name?: string,
    readonly timeoutSmall = TIMEOUT,
    readonly timeoutLarge = TIMEOUT_LARGE
  ) {
    super();
    this.userStore = new UserStore(db);
    this.registryStore = new RegistryStore(adminAddress, db);
    this.connectionRegistryStore = new HubConnectionRegistryStore(db);
    this.joinRateLimiter = new TokenBucketRateLimiter(rateLimit.join);
    this.searchRateLimiter = new TokenBucketRateLimiter(rateLimit.search);
    this.globalRateLimiter = new TokenBucketRateLimiter(rateLimit.global);

    if (name !== undefined) {
      this.name = name;
    } else {
      this.name = getPubkeyB64Short(this.keypair.pubKey);
    }
  }


  static async setHubRegistryToDB(db: IAtomicDB, e: THubRegistryWithProof) {
    const registryStore = new RegistryStore(e.hubRegistry.adminAddress, db);
    await registryStore.set(e);
  }

  async start(port?: number, hostname?: string) {
    this.hubRegistryWithProof = await this.registryStore.get();
    await super.start(port, hostname);
  }

  async onJoinRequest(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage,
    bytes: Uint8Array
  ) {
    const ip = getIPFromHTTPRequest(request);
    logger.debug(`${this.name}: onJoinRequest from ip=${ip}`);
    if (!this.joinRateLimiter.allow(ip)) {
      rwtor.terminate();
      return;
    }
    const req = JoinReq.deserialize(bytes);
    const hashedData = getCounterSignHashedData(req.userSig);
    const hubSig = signMsg(this.keypair.privKey, hashedData);
    rwtor.write(new JoinResp(hubSig).serialize());
    await this.userStore.set(req.userPubkey, {
      userSig: req.userSig,
      hubSig: hubSig
    });
  }

  async onSearchRequest(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage,
    bytes: Uint8Array
  ) {
    const ip = getIPFromHTTPRequest(request);
    logger.debug(`${this.name}: onSearchRequest from ip=${ip}`);
    if (!this.searchRateLimiter.allow(ip)) {
      logger.info(`${this.name}: too many search requests from ip=${ip}`);
      rwtor.terminate();
      return;
    }
    // TODO: Handle `RequestSearchMessage`. If it's a proof of user, disconnect
    //  right away if the proof is invalid.
    RequestSearchMessage.deserialize(bytes);

    const userRegistries = await this.userStore.getAll();
    logger.debug(`${this.name}: have ${userRegistries.length} users`);

    for (const [userPubkey, userRegistry] of userRegistries) {
      logger.debug(`${this.name}: sending msg0`);
      const beginMessage0 = new SearchMessage0(SEARCH_MSG_0_IS_NOT_END);
      rwtor.write(beginMessage0.serialize());
      await this.initiateSMP(rwtor, userPubkey, userRegistry);
    }

    // No More Users
    const endMessage0 = new SearchMessage0(SEARCH_MSG_0_IS_END);
    logger.debug(`${this.name}: sending msg0: no more users`);
    rwtor.write(endMessage0.serialize());

    const hubConnectionRegistries = await this.connectionRegistryStore.getAll();
    logger.debug(`${this.name}: have ${hubConnectionRegistries.length} connected hubs`);

    for (const [hubPubkey, hubConnectionWithProofObj] of hubConnectionRegistries) {
      // TODO: send `proofSaltedConnection` and let initiator verifies it. The initiator keeps searching only if
      //  the proof is valid.
      const hubPubkeyName = getPubkeyB64Short(hubPubkey);
      const proofSaltedConnection = await this.genProofSaltedConnection(hubPubkey, hubConnectionWithProofObj);
      const msg = new ProofSaltedConnectionReq(proofSaltedConnection);
      rwtor.write(msg.serialize());

      const msgBytesResp = await rwtor.read(this.timeoutSmall);
      const msgResp = ProofSaltedConnectionResp.deserialize(msgBytesResp);
      if (msgResp.value === PROOF_SALTED_CONNECTION_RESP_REJECT) {
        // Skip this hub.
        continue;
      } else if (msgResp.value === PROOF_SALTED_CONNECTION_RESP_ACCEPT) {
        // Okay cool.
      } else {
        // `msgResp` should only be ACCEPT OR REJECT.
        rwtor.terminate();
        throw new RequestFailed(`msgResp should only be ACCEPT OR REJECT: msgResp=${msgResp.value}`);
      }

      logger.debug(`${this.name}: generated proof salted connection for ${hubPubkeyName}`);
      const hubAddr = hubConnectionWithProofObj.address;
      const hubConn = await connect(hubAddr.host, hubAddr.port);
      logger.debug(`${this.name}: connected with ${hubPubkeyName}. addr=${hubAddr}`);
      // Relay messages between initiator and this hub.
      logger.debug(`${this.name}: relaying messages for hub ${hubPubkeyName}`);
      await relay(rwtor, hubConn);
      logger.debug(`${this.name}: stopped relaying`);
    }
    logger.debug(`${this.name}: no more hubs. closing the socket`);
    rwtor.close();
  }

  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    // Delegate to the corresponding handler
    const ip = getIPFromHTTPRequest(request);
    if (!this.globalRateLimiter.allow(ip)) {
      rwtor.terminate();
      return;
    }
    const data = await rwtor.read();
    const tlv = TLV.deserialize(data);
    const tlvType = bigIntToNumber(tlv.type.value);

    const remoteAddress = request.connection.remoteAddress;
    if (remoteAddress !== undefined) {
      logger.info(
        `${this.name}: incoming connection from ${remoteAddress}, type=${tlvType}`
      );
    } else {
      logger.info(
        `${this.name}: incoming connection from unknown address, type=${tlvType}`
      );
    }
    switch (tlvType) {
      case msgType.JoinReq:
        await this.onJoinRequest(rwtor, request, tlv.value);
        rwtor.close();
        break;
      case msgType.SearchReq:
        await this.onSearchRequest(rwtor, request, tlv.value);
        rwtor.close();
        break;
      default:
        logger.error(`${this.name}: type ${tlvType} is unsupported`);
        rwtor.terminate();
    }
  }

  async removeUser(pubkey: PubKey) {
    await this.userStore.remove(pubkey);
  }

  async removeAllUsers() {
    await this.userStore.removeAll();
  }

  async setHubConnectionRegistry(remotePubkey: PubKey, e: THubConnectionWithProof) {
    await this.connectionRegistryStore.set(remotePubkey, e);
  }

  async genProofSaltedConnection(
    targetPubkey: PubKey,
    hubConnectionRegistryWithProof: THubConnectionWithProof,
  ) {
    const hubConectionRegistry = new HubConnectionRegistry(hubConnectionRegistryWithProof.hubConnection);
    const sortedHubConnectionRegistry = hubConectionRegistry.toSorted();
    // hubPubkey
    let creatorIndex: number;
    if (
      isPubkeySame(this.keypair.pubKey, sortedHubConnectionRegistry.hubPubkey0)
    ) {
      if (!isPubkeySame(targetPubkey, sortedHubConnectionRegistry.hubPubkey1)) {
        throw new Error(`targetPubkey mismatches sorted.hubPubkey1`);
      }
      creatorIndex = 0;
    } else if (isPubkeySame(this.keypair.pubKey, sortedHubConnectionRegistry.hubPubkey1)) {
      if (!isPubkeySame(targetPubkey, sortedHubConnectionRegistry.hubPubkey0)) {
        throw new Error(`targetPubkey mismatches sorted.hubPubkey0`);
      }
      creatorIndex = 1;
    } else {
      throw new Error(
        'creator\'s public key is not found in hub connection registry'
      );
    }
    const hubRegistryWithProof = await this.registryStore.get();
    const hubRegistry = new HubRegistry(hubRegistryWithProof.hubRegistry);
    const proof = genProofSaltedConnection({
      creator: BigInt(creatorIndex),
      creatorHubRegistryMerkleProof: hubRegistryWithProof.merkleProof,
      creatorHubRegistry: hubRegistry,
      hubConnectionRegistry: hubConectionRegistry,
      hubConnectionMerkleProof: hubConnectionRegistryWithProof.merkleProof,
      adminAddress: this.adminAddress,
    });
    return proof;
  }

  private async initiateSMP(rwtor: IWebSocketReadWriter, userPubkey: PubKey, userRegistry: TUserRegistry) {
    logger.debug(`${this.name}: running smp, userPubkey=${getPubkeyB64Short(userPubkey)}`);
    const secret = hashPointToScalar(userPubkey);
    const stateMachine = new SMPStateMachine(secret);
    const h2 = (stateMachine.state as SMPState1).s2;
    const h3 = (stateMachine.state as SMPState1).s3;
    const smpMsg1 = stateMachine.transit(null);
    if (smpMsg1 === null) {
      throw new Error("smpMsg1tlv should not be null");
    }
    logger.debug(`${this.name}: sending msg1`);
    rwtor.write(smpMsg1.serialize());
    const msg2Bytes = await rwtor.read(this.timeoutSmall);
    const msg2 = SearchMessage2.deserialize(msg2Bytes);
    logger.debug(`${this.name}: received msg2`);
    const state2 = stateMachine.state as SMPState2;
    const smpMsg3 = stateMachine.transit(msg2);
    if (smpMsg3 === null) {
      throw new Error("this should never happen");
    }
    if (state2.r4 === undefined) {
      throw new Error("r4 should have been generated to compute Ph and Qh");
    }
    const r4h = state2.r4;
    if (this.hubRegistryWithProof === undefined) {
      throw new Error(
        "hubRegistryWithProof should have been loaded when server started"
      );
    }
    const proofOfSMP = await genProofOfSMP({
      h2,
      h3,
      r4h,
      msg1: SMPMessage1Wire.fromTLV(smpMsg1),
      msg2: SMPMessage2Wire.fromTLV(msg2),
      msg3: SMPMessage3Wire.fromTLV(smpMsg3),
      proof: this.hubRegistryWithProof.merkleProof,
      hubRegistry: new HubRegistry(this.hubRegistryWithProof.hubRegistry),
      pubkeyC: userPubkey,
      pubkeyHub: this.keypair.pubKey,
      sigJoinMsgC: userRegistry.userSig,
      sigJoinMsgHub: userRegistry.hubSig
    });
    const msg3 = new SearchMessage3(smpMsg3, proofOfSMP);
    logger.debug(`${this.name}: sending msg3`);
    rwtor.write(msg3.serialize());
  }
}

export const sendJoinHubReq = async (
  ip: string,
  port: number,
  userPubkey: PubKey,
  userSig: Signature,
  hubPubkey: PubKey,
  timeout: number = TIMEOUT
): Promise<Signature> => {
  const rwtor = await connect(ip, port);
  const joinReq = new JoinReq(userPubkey, userSig);
  const req = new TLV(new Short(msgType.JoinReq), joinReq.serialize());
  rwtor.write(req.serialize());
  const respBytes = await rwtor.read(timeout);
  const resp = JoinResp.deserialize(respBytes);
  const hasedData = getCounterSignHashedData(userSig);
  if (!verifySignedMsg(hasedData, resp.hubSig, hubPubkey)) {
    throw new RequestFailed("hub signature is invalid");
  }
  return resp.hubSig;
};

const receiveSMP = async (
  rwtor: IWebSocketReadWriter,
  target: PubKey,
  timeoutSmall: number,
  timeoutLarge: number,
) => {
  const secret = hashPointToScalar(target);
  const stateMachine = new SMPStateMachine(secret);
  const a3 = (stateMachine.state as SMPState1).s3;
  const msg1Bytes = await rwtor.read(timeoutSmall);
  const msg1 = SearchMessage1.deserialize(msg1Bytes);
  logger.debug("sendSearchReq: received msg1");
  const msg2 = stateMachine.transit(msg1);
  if (msg2 === null) {
    throw new Error("this should never happen");
  }
  logger.debug("sendSearchReq: sending msg2");
  rwtor.write(msg2.serialize());
  const msg3Bytes = await rwtor.read(timeoutLarge);
  logger.debug("sendSearchReq: received msg3");
  const msg3 = SearchMessage3.deserialize(msg3Bytes);
  stateMachine.transit(msg3.smpMsg3);
  if (!stateMachine.isFinished()) {
    throw new RequestFailed(
      "smp should have been finished. there must be something wrong"
    );
  }
  if (stateMachine.getResult()) {
    logger.debug(
      `sendSearchReq: SMP has matched, target=${getPubkeyB64Short(target)} is found`
    );
    const pa = SMPMessage2Wire.fromTLV(msg2).pb;
    const smpMsg3 = SMPMessage3Wire.fromTLV(msg3.smpMsg3);
    const ph = smpMsg3.pa;
    const rh = smpMsg3.ra;
    return {
      a3,
      pa,
      ph,
      rh,
      proofOfSMP: msg3.proof
    };
  } else {
    return undefined;
  }
}

// TODO:
//  - 1. Should return a list of proof of indirect connection
//  - 2. Add maxDepth
export const sendSearchReq = async (
  ip: string,
  port: number,
  target: PubKey,
  depth: number = 6,
  timeoutSmall: number = TIMEOUT,
  timeoutLarge: number = TIMEOUT_LARGE,
  maximumTrial: number = MAXIMUM_TRIALS
): Promise<TSMPResult | undefined> => {
  const rwtor = await connect(ip, port);
  return await _sendSearchReq(
    rwtor, target, depth, timeoutSmall, timeoutLarge, maximumTrial
  );
}

const _sendSearchReq = async (
  rwtor: IWebSocketReadWriter,
  target: PubKey,
  depth: number,
  timeoutSmall: number = TIMEOUT,
  timeoutLarge: number = TIMEOUT_LARGE,
  maximumTrial: number = MAXIMUM_TRIALS
): Promise<TSMPResult | undefined> => {
  if (depth <= 0) {
    logger.debug('_sendSearchReq: depth <= 0');
    return;
  }
  const requestSearchMsg = new RequestSearchMessage();
  const req = new TLV(new Short(msgType.SearchReq), requestSearchMsg.serialize());
  rwtor.write(req.serialize());

  let smpRes: TSMPResult | undefined = undefined;
  let numTrials = 0;

  // Run SMP with all users of the hub.
  while (rwtor.connected && numTrials < maximumTrial) {
    logger.debug(
      `_sendSearchReq: starting trial ${numTrials}, waiting for msg0 from the server`
    );
    const msg0Bytes = await rwtor.read(timeoutSmall);
    const msg0 = SearchMessage0.deserialize(msg0Bytes);
    if (msg0.value === SEARCH_MSG_0_IS_END) {
      logger.debug('_sendSearchReq: search has ended');
      break;
    }
    const res = await receiveSMP(rwtor, target, timeoutSmall, timeoutLarge);
    if (res !== undefined) {
      smpRes = res;
    }
    numTrials++;
  }

  // Keep searching through the connected hubs of the hub with messages proxied.
  while (rwtor.connected) {
    const msgBytesProofSaltedConnection = await rwtor.read(timeoutSmall);
    const proofSaltedConnectionReq = ProofSaltedConnectionReq.deserialize(msgBytesProofSaltedConnection);
    // If proof is invalid, skip this hub.
    let msgResp: ProofSaltedConnectionResp;
    if (!verifyProofSaltedConnection(proofSaltedConnectionReq.proof)) {
      msgResp = new ProofSaltedConnectionResp(PROOF_SALTED_CONNECTION_RESP_REJECT);
    }
    //
    const proofSaltedConnectionPublics = parseProofSaltedConnectionPublicSignals(proofSaltedConnectionReq.proof.publicSignals);
    msgResp = new ProofSaltedConnectionResp(PROOF_SALTED_CONNECTION_RESP_ACCEPT);

    rwtor.write(msgResp.serialize());

    const res = await _sendSearchReq(rwtor, target, depth - 1, timeoutSmall, timeoutLarge, maximumTrial);
    if (res !== undefined) {
      smpRes = res;
    }
  }

  return smpRes;
};
