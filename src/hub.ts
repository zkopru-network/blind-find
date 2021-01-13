import * as http from "http";
import { Keypair, PubKey, Signature } from "maci-crypto";
import WebSocket, { AddressInfo } from "ws";

import {
  getCounterSignHashedData,
  HubRegistry,
  signMsg,
  verifySignedMsg
} from ".";
import { RequestFailed } from "./exceptions";
import {
  JoinReq,
  JoinResp,
  SearchMessage0,
  SearchMessage1,
  SearchMessage2,
  SearchMessage3,
  msgType
} from "./serialization";
import { TLV, Short } from "./smp/serialization";
import { bigIntToNumber } from "./smp/utils";
import {
  BaseServer,
  connect,
  IIPRateLimiter,
  TokenBucketRateLimiter,
  TRateLimitParams,
  WebSocketAsyncReadWriter
} from "./websocket";
import { TIMEOUT, MAXIMUM_TRIALS, TIMEOUT_LARGE } from "./configs";
import { SMPStateMachine } from "./smp";
import { hashPointToScalar } from "./utils";
import { MerkleProof } from "./interfaces";
import { genProofOfSMP, TProof } from "./circuits/ts";
import { SMPState1, SMPState2 } from "./smp/state";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "./smp/v4/serialization";
import { BabyJubPoint } from "./smp/v4/babyJub";

type TUserRegistry = { userSig: Signature; hubSig: Signature };
type TUserStoreMap = Map<BigInt, TUserRegistry>;
type TUserStorePubkeyMap = Map<BigInt, PubKey>;
type TIterItem = [PubKey, TUserRegistry];
type TSMPResult = {
  a3: BigInt;
  pa: BabyJubPoint;
  ph: BabyJubPoint;
  rh: BabyJubPoint;
  proofOfSMP: TProof;
};

interface IUserStore extends Iterable<TIterItem> {
  get(pubkey: PubKey): TUserRegistry | undefined;
  set(pubkey: PubKey, registry: TUserRegistry): void;
  size: number;
}

/**
 * `UserStore` stores the mapping from `Pubkey` to `TUserRegistry`.
 * It is implemented because NodeJS doesn't work well with Array-typed keys.
 */
export class UserStore implements IUserStore {
  private mapStore: TUserStoreMap;
  private mapPubkey: TUserStorePubkeyMap;

  constructor() {
    this.mapStore = new Map<BigInt, TUserRegistry>();
    this.mapPubkey = new Map<BigInt, PubKey>();
  }

  public get size() {
    return this.mapStore.size;
  }

  *[Symbol.iterator]() {
    // Shallow-copy the maps, to avoid race condition.
    const mapStoreCopied = new Map(this.mapStore);
    const mapPubkeyCopied = new Map(this.mapPubkey);
    for (const item of mapStoreCopied) {
      const pubkeyHash = item[0];
      const pubkey = mapPubkeyCopied.get(pubkeyHash);
      if (pubkey === undefined) {
        throw new Error("pubkey should be found");
      }
      yield [pubkey, item[1]] as TIterItem;
    }
  }

  private hash(pubkey: PubKey): BigInt {
    return hashPointToScalar(pubkey);
  }

  get(pubkey: PubKey) {
    return this.mapStore.get(this.hash(pubkey));
  }

  set(pubkey: PubKey, registry: TUserRegistry) {
    const pubkeyHash = this.hash(pubkey);
    this.mapPubkey.set(pubkeyHash, pubkey);
    this.mapStore.set(pubkeyHash, registry);
  }

  forEach(callbackFn: (value: TUserRegistry, key: PubKey) => void): void {
    this.mapStore.forEach((value, key, map) => {
      const pubkey = this.mapPubkey.get(key);
      if (pubkey === undefined) {
        throw new Error("pubkey shouldn't be undefined");
      }
      callbackFn(value, pubkey);
    });
  }
}

// TODO: Probably we can use `close.code` to indicate the reason why a socket is closed by
//  the server.
//  Ref: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
/**
 * `HubServer` is run by Hubs. The server receives requests and send the corresponding
 *  response to the users.
 */
export class HubServer extends BaseServer {
  // TODO: Add a lock to protect `userStore` from racing between tasks?
  userStore: IUserStore;

  globalRateLimiter: IIPRateLimiter;
  joinRateLimiter: IIPRateLimiter;
  searchRateLimiter: IIPRateLimiter;

  constructor(
    readonly keypair: Keypair,
    readonly hubRegistry: HubRegistry,
    readonly merkleProof: MerkleProof,
    globalRateLimit: TRateLimitParams,
    joinRateLimit: TRateLimitParams,
    searchRateLimit: TRateLimitParams,
    userStore?: IUserStore,
    readonly timeoutSmall = TIMEOUT,
    readonly timeoutLarge = TIMEOUT_LARGE
  ) {
    super();
    if (userStore !== undefined) {
      this.userStore = userStore;
    } else {
      this.userStore = new UserStore();
    }
    this.globalRateLimiter = new TokenBucketRateLimiter(globalRateLimit);
    this.joinRateLimiter = new TokenBucketRateLimiter(joinRateLimit);
    this.searchRateLimiter = new TokenBucketRateLimiter(searchRateLimit);
  }

  onJoinRequest(socket: WebSocket, ip: string, bytes: Uint8Array) {
    console.debug("server: onJoinRequest");
    if (!this.joinRateLimiter.allow(ip)) {
      socket.terminate();
      return;
    }
    const req = JoinReq.deserialize(bytes);
    const hashedData = getCounterSignHashedData(req.userSig);
    const hubSig = signMsg(this.keypair.privKey, hashedData);
    socket.send(new JoinResp(hubSig).serialize());
    this.userStore.set(req.userPubkey, {
      userSig: req.userSig,
      hubSig: hubSig
    });
  }

  async onSearchRequest(socket: WebSocket, ip: string, bytes: Uint8Array) {
    console.debug("server: onSearchRequest");
    if (!this.searchRateLimiter.allow(ip)) {
      socket.terminate();
      return;
    }
    const rwtor = new WebSocketAsyncReadWriter(socket);
    // SearchMessage0
    // TODO: Handle Message0. If it's a proof of user, disconnect
    //  right away if the proof is invalid.
    SearchMessage0.deserialize(bytes);

    for (const peer of this.userStore) {
      const [pubkey, userRegistry] = peer;
      console.debug(`onSearchRequest: running smp using ${pubkey}`);
      const secret = hashPointToScalar(pubkey);
      const stateMachine = new SMPStateMachine(secret);
      const h2 = (stateMachine.state as SMPState1).s2;
      const h3 = (stateMachine.state as SMPState1).s3;
      const smpMsg1 = stateMachine.transit(null);
      if (smpMsg1 === null) {
        throw new Error("smpMsg1tlv should not be null");
      }
      const msg1 = new SearchMessage1(false, smpMsg1);
      console.debug(`onSearchRequest: sending msg1`);
      rwtor.write(msg1.serialize());
      const msg2Bytes = await rwtor.read(this.timeoutSmall);
      const msg2 = SearchMessage2.deserialize(msg2Bytes);
      console.debug(`onSearchRequest: received msg2`);
      const state2 = stateMachine.state as SMPState2;
      const smpMsg3 = stateMachine.transit(msg2);
      if (smpMsg3 === null) {
        throw new Error("this should never happen");
      }
      if (state2.r4 === undefined) {
        throw new Error("r4 should have been generated to compute Ph and Qh");
      }
      const r4h = state2.r4;
      const proofOfSMP = await genProofOfSMP({
        h2,
        h3,
        r4h,
        msg1: SMPMessage1Wire.fromTLV(smpMsg1),
        msg2: SMPMessage2Wire.fromTLV(msg2),
        msg3: SMPMessage3Wire.fromTLV(smpMsg3),
        root: this.merkleProof.root,
        proof: this.merkleProof,
        hubRegistry: this.hubRegistry,
        pubkeyC: pubkey,
        pubkeyHub: this.keypair.pubKey,
        sigJoinMsgC: userRegistry.userSig,
        sigJoinMsgHub: userRegistry.hubSig
      });
      const msg3 = new SearchMessage3(smpMsg3, proofOfSMP);
      console.debug(`onSearchRequest: sending msg3`);
      rwtor.write(msg3.serialize());
    }
    const endMessage1 = new SearchMessage1(true);
    console.debug(`onSearchRequest: sending ending msg1`);
    rwtor.write(endMessage1.serialize());
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    // Delegate to the corresponding handler
    const ip = (request.connection.address() as AddressInfo).address;
    if (!this.globalRateLimiter.allow(ip)) {
      socket.terminate();
      return;
    }
    socket.onmessage = async event => {
      const tlv = TLV.deserialize(event.data as Buffer);
      const tlvType = bigIntToNumber(tlv.type.value);

      const remoteAddress = request.connection.remoteAddress;
      if (remoteAddress !== undefined) {
        console.info(
          `server: incoming connection from ${remoteAddress}, type=${tlvType}`
        );
      } else {
        console.info(
          `server: incoming connection from unknown address, type=${tlvType}`
        );
      }
      switch (tlvType) {
        case msgType.JoinReq:
          this.onJoinRequest(socket, ip, tlv.value);
          socket.close();
          break;
        case msgType.SearchReq:
          await this.onSearchRequest(socket, ip, tlv.value);
          socket.close();
          break;
        default:
          console.error(`type ${tlvType} is unsupported`);
          socket.terminate();
      }
    };
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
  const c = await connect(ip, port);
  const rwtor = new WebSocketAsyncReadWriter(c);
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

export const sendSearchReq = async (
  ip: string,
  port: number,
  target: PubKey,
  timeoutSmall: number = TIMEOUT,
  timeoutLarge: number = TIMEOUT_LARGE,
  maximumTrial: number = MAXIMUM_TRIALS
): Promise<TSMPResult | null> => {
  const c = await connect(ip, port);
  const rwtor = new WebSocketAsyncReadWriter(c);

  const msg0 = new SearchMessage0();
  const req = new TLV(new Short(msgType.SearchReq), msg0.serialize());
  rwtor.write(req.serialize());

  let smpRes: TSMPResult | null = null;
  let numTrials = 0;

  const secret = hashPointToScalar(target);

  while (numTrials < maximumTrial) {
    console.debug(
      `sendSearchReq: starting trial ${numTrials}, waiting for msg1 from the server`
    );
    const stateMachine = new SMPStateMachine(secret);
    const a3 = (stateMachine.state as SMPState1).s3;
    const msg1Bytes = await rwtor.read(timeoutSmall);
    const msg1 = SearchMessage1.deserialize(msg1Bytes);
    console.debug("sendSearchReq: received msg1");
    // Check if there is no more candidates.
    if (msg1.isEnd) {
      break;
    }
    if (msg1.smpMsg1 === undefined) {
      throw new Error(
        "this should never happen, constructor already handles it for us"
      );
    }
    const msg2 = stateMachine.transit(msg1.smpMsg1);
    if (msg2 === null) {
      throw new Error("this should never happen");
    }
    console.debug("sendSearchReq: sending msg2");
    rwtor.write(msg2.serialize());
    const msg3Bytes = await rwtor.read(timeoutLarge);
    console.debug("sendSearchReq: received msg3");
    const msg3 = SearchMessage3.deserialize(msg3Bytes);
    stateMachine.transit(msg3.smpMsg3);
    if (!stateMachine.isFinished()) {
      throw new RequestFailed(
        "smp should have been finished. there must be something wrong"
      );
    }
    if (stateMachine.getResult()) {
      console.debug(
        `sendSearchReq: SMP has matched, target=${target} is found`
      );
      const pa = SMPMessage2Wire.fromTLV(msg2).pb;
      const smpMsg3 = SMPMessage3Wire.fromTLV(msg3.smpMsg3);
      const ph = smpMsg3.pa;
      const rh = smpMsg3.ra;
      smpRes = {
        a3,
        pa,
        ph,
        rh,
        proofOfSMP: msg3.proof
      };
    }
    numTrials++;
  }
  return smpRes;
};
