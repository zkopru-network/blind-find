import * as http from "http";
import { encrypt, Keypair, PubKey, Signature } from "maci-crypto";
import { AddressInfo } from "ws";

import { logger } from "./logger";
import { getCounterSignHashedData, signMsg } from ".";
import { DatabaseCorrupted, HubRegistryNotFound } from "./exceptions";
import {
  JoinReq,
  JoinResp,
  SearchMessage0,
  SearchMessage1,
  SearchMessage2,
  SearchMessage3,
  msgType
} from "./serialization";
import { TLV } from "./smp/serialization";
import { bigIntToNumber } from "./smp/utils";
import {
  connect,
  IIPRateLimiter,
  TokenBucketRateLimiter,
  TRateLimitParams,
  IWebSocketReadWriter
} from "./websocket";
import { BaseServer } from "./server";
import { TIMEOUT, TIMEOUT_LARGE } from "./configs";
import { objToHubRegistry, THubRegistryObj } from "./dataProvider";
import { SMPStateMachine } from "./smp";
import { hashPointToScalar, stringToPlaintext } from "./utils";
import { IAtomicDB, MerkleProof } from "./interfaces";
import { genProofOfSMP } from "./circuits";
import { IDBMap, DBMap } from "./db";
import { SMPState1, SMPState2, SMPState4 } from "./smp/state";
import {
  Point,
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "./smp/v4/serialization";
import { BabyJubPoint } from "./smp/v4/babyJub";

type TUserRegistry = {
  userSig: Signature;
  hubSig: Signature;
  userHost: string;
};
type TIterItem = [PubKey, TUserRegistry];

interface IUserStore extends AsyncIterable<TIterItem> {
  get(pubkey: PubKey): Promise<TUserRegistry | undefined>;
  set(pubkey: PubKey, registry: TUserRegistry): Promise<void>;
  getLength(): Promise<number>;
  remove(pubkey: PubKey): Promise<void>;
  removeAll(): Promise<void>;
}

const USER_STORE_PREFIX = "blind-find-hub-users";
/**
 * `UserStore` stores the mapping from `Pubkey` to `TUserRegistry`.
 */
export class UserStore implements IUserStore {
  private mapStore: IDBMap<TUserRegistry>;
  maxKeyLength = Point.size * 2;

  constructor(db: IAtomicDB) {
    this.mapStore = new DBMap<TUserRegistry>(
      USER_STORE_PREFIX,
      db,
      this.maxKeyLength
    );
  }

  async getLength() {
    return await this.mapStore.getLength();
  }

  async *[Symbol.asyncIterator]() {
    for await (const obj of this.mapStore) {
      const pubkey = this.decodePubkey(obj.key);
      yield [pubkey, obj.value] as TIterItem;
    }
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

  async set(pubkey: PubKey, registry: TUserRegistry) {
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

export type THubRegistryWithProof = {
  hubRegistry: THubRegistryObj;
  merkleProof: MerkleProof;
};

const REGISTRY_STORE_PREFIX = "blind-find-hub-registry";
/**
 * `RegistryStore` stores the mapping from `adminAddress` to `TUserRegistry`.
 */
export class RegistryStore {
  private dbMap: IDBMap<THubRegistryWithProof>;
  constructor(private readonly adminAddress: BigInt, db: IAtomicDB) {
    this.dbMap = new DBMap<THubRegistryWithProof>(
      REGISTRY_STORE_PREFIX,
      db,
      this.getRegistryKey().length
    );
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
  name = "HubServer";
  userStore: IUserStore;
  registryStore: RegistryStore;

  joinRateLimiter: IIPRateLimiter;
  searchRateLimiter: IIPRateLimiter;
  globalRateLimiter: IIPRateLimiter;

  hubRegistryWithProof?: THubRegistryWithProof;

  constructor(
    readonly keypair: Keypair,
    readonly adminAddress: BigInt,
    rateLimit: THubRateLimit,
    db: IAtomicDB,
    readonly timeoutSmall = TIMEOUT,
    readonly timeoutLarge = TIMEOUT_LARGE
  ) {
    super();
    this.userStore = new UserStore(db);
    this.registryStore = new RegistryStore(adminAddress, db);
    this.joinRateLimiter = new TokenBucketRateLimiter(rateLimit.join);
    this.searchRateLimiter = new TokenBucketRateLimiter(rateLimit.search);
    this.globalRateLimiter = new TokenBucketRateLimiter(rateLimit.global);
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
    ip: string,
    bytes: Uint8Array
  ) {
    logger.debug(`${this.name}: onJoinRequest`);
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
      hubSig: hubSig,
      userHost: JSON.stringify(req.userHost)
    });
  }

  async onSearchRequest(
    rwtor: IWebSocketReadWriter,
    ip: string,
    bytes: Uint8Array
  ) {
    logger.debug(`${this.name}: onSearchRequest`);
    if (!this.searchRateLimiter.allow(ip)) {
      rwtor.terminate();
      return;
    }
    // SearchMessage0
    // TODO: Handle Message0. If it's a proof of user, disconnect
    //  right away if the proof is invalid.
    SearchMessage0.deserialize(bytes);

    for await (const peer of this.userStore) {
      const [pubkey, userRegistry] = peer;
      logger.debug(`${this.name}: running smp using ${pubkey}`);
      const secret = hashPointToScalar(pubkey);
      const stateMachine = new SMPStateMachine(secret);
      const h2 = (stateMachine.state as SMPState1).s2;
      const h3 = (stateMachine.state as SMPState1).s3;
      const smpMsg1 = stateMachine.transit(null);
      if (smpMsg1 === null) {
        throw new Error("smpMsg1tlv should not be null");
      }
      const msg1 = new SearchMessage1(false, smpMsg1);
      logger.debug(`${this.name}: sending msg1`);
      rwtor.write(msg1.serialize());
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

      const state3 = stateMachine.state as SMPState4;
      const g2 = state3.g2 as BabyJubPoint;
      const s = hashPointToScalar(g2.point);
      const encryptedAddress = encrypt(
        stringToPlaintext(userRegistry.userHost),
        s
      );

      const proofOfSMP = await genProofOfSMP({
        h2,
        h3,
        r4h,
        msg1: SMPMessage1Wire.fromTLV(smpMsg1),
        msg2: SMPMessage2Wire.fromTLV(msg2),
        msg3: SMPMessage3Wire.fromTLV(smpMsg3),
        proof: this.hubRegistryWithProof.merkleProof,
        hubRegistry: objToHubRegistry(this.hubRegistryWithProof.hubRegistry),
        pubkeyC: pubkey,
        pubkeyHub: this.keypair.pubKey,
        sigJoinMsgC: userRegistry.userSig,
        sigJoinMsgHub: userRegistry.hubSig
      });
      const msg3 = new SearchMessage3(smpMsg3, proofOfSMP, encryptedAddress);
      logger.debug(`${this.name}: sending msg3`);
      rwtor.write(msg3.serialize());
    }
    const endMessage1 = new SearchMessage1(true);
    logger.debug(`${this.name}: sending ending msg1`);
    rwtor.write(endMessage1.serialize());
  }

  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    // Delegate to the corresponding handler
    const ip = (request.connection.address() as AddressInfo).address;
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
        await this.onJoinRequest(rwtor, ip, tlv.value);
        rwtor.close();
        break;
      case msgType.SearchReq:
        await this.onSearchRequest(rwtor, ip, tlv.value);
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
}
