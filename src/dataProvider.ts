import * as http from "http";
import { PubKey, Signature } from "maci-crypto";
import { AddressInfo } from "ws";

import { logger } from "./logger";

import { HubRegistry, HubRegistryTree } from "./";
import { LEVELS, TIMEOUT } from "./configs";
import { DBMap, IDBMap } from "./db";
import { RequestFailed, ValueError } from "./exceptions";
import { IAtomicDB } from "./interfaces";
import { GetMerkleProofReq, GetMerkleProofResp } from "./serialization";
import { TEthereumAddress } from "./types";
import {
  BaseServer,
  connect,
  IIPRateLimiter,
  TokenBucketRateLimiter,
  TRateLimitParams,
  IWebSocketReadWriter
} from "./websocket";
import { bigIntToHexString } from "./utils";
import { Scalar } from "./smp/v4/serialization";

const LEAVES_PREFIX = "blind-find-data-provider-leaves";

export type THubRegistryObj = {
  sig: Signature;
  pubkey: PubKey;
  adminAddress: TEthereumAddress;
};

export const hubRegistryToObj = (e: HubRegistry) => {
  return {
    sig: e.sig,
    pubkey: e.pubkey,
    adminAddress: e.adminAddress
  };
};

export const objToHubRegistry = (obj: THubRegistryObj) => {
  return new HubRegistry(obj.sig, obj.pubkey, obj.adminAddress);
};

// Result from `hash` is at most 32 bytes, to hex string it is length 64.
const maxHubRegistryKeyLength = Scalar.size * 2;

export class HubRegistryTreeDB {
  dbMap: IDBMap<THubRegistryObj>;

  constructor(readonly tree: HubRegistryTree, db: IAtomicDB) {
    this.dbMap = new DBMap<THubRegistryObj>(LEAVES_PREFIX, db, maxHubRegistryKeyLength);
  }

  static async fromDB(db: IAtomicDB, levels = LEVELS) {
    const tree = new HubRegistryTree(levels);
    const dbMap = new DBMap<THubRegistryObj>(LEAVES_PREFIX, db, maxHubRegistryKeyLength);
    // Load leaves from DB.
    for await (const l of dbMap) {
      tree.insert(objToHubRegistry(l.value));
    }
    return new HubRegistryTreeDB(tree, db);
  }

  private getDBKey(e: HubRegistry): string {
    const h = e.hash();
    const keyHex = bigIntToHexString(h);
    if (keyHex.length > maxHubRegistryKeyLength) {
      throw new Error(
        `keyHex is longer than maxKeyLength: keyHex=${keyHex}, maxKeyLength=${maxHubRegistryKeyLength}`
      );
    }
    return keyHex;
  }

  async insert(e: HubRegistry) {
    // If hubRegistry already exists in the tree, skip it.
    if (this.getIndex(e) !== undefined) {
      throw new ValueError(`registry ${this.getDBKey(e)} already exists`);
    }
    if (!e.verify()) {
      throw new ValueError(
        `signature of registry ${this.getDBKey(e)} is invalid`
      );
    }
    await this.dbMap.set(this.getDBKey(e), hubRegistryToObj(e));
    this.tree.insert(e);
  }

  getIndex(e: HubRegistry) {
    return this.tree.getIndex(e);
  }
}

/**
 * Read-only merkle path provider
 */
export class DataProviderServer extends BaseServer {
  name = "DataProvider";
  rateLimiter: IIPRateLimiter;
  constructor(
    readonly adminAddress: TEthereumAddress,
    readonly treeDB: HubRegistryTreeDB,
    readonly rateLimitConfig: TRateLimitParams
  ) {
    super();
    this.rateLimiter = new TokenBucketRateLimiter(rateLimitConfig);
  }

  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    const ip = (request.connection.address() as AddressInfo).address;
    logger.info(`${this.name}: new incoming connection from ${ip}`);
    if (!this.rateLimiter.allow(ip)) {
      rwtor.terminate();
      return;
    }
    const data = await rwtor.read();
    const req = GetMerkleProofReq.deserialize(data as Buffer);
    const hubRegistry = new HubRegistry(
      req.hubSig,
      req.hubPubkey,
      this.adminAddress
    );
    if (!hubRegistry.verify()) {
      // Invalid hub registry.
      rwtor.terminate();
      return;
    }
    const index = this.treeDB.getIndex(hubRegistry);
    logger.debug(
      `${this.name}: received req: ${req.hubPubkey}, index=${index}`
    );
    if (index === undefined) {
      // Not Found.
      rwtor.terminate();
      return;
    }
    const merkleProof = this.treeDB.tree.tree.genMerklePath(index);
    const resp = new GetMerkleProofResp(merkleProof);
    rwtor.write(resp.serialize());
    rwtor.close();
  }
}

export const sendGetMerkleProofReq = async (
  ip: string,
  port: number,
  hubRegistry: HubRegistry,
  timeout: number = TIMEOUT
): Promise<GetMerkleProofResp> => {
  if (!hubRegistry.verify()) {
    throw new ValueError("invalid hub registry");
  }
  const rwtor = await connect(ip, port);
  const req = new GetMerkleProofReq(hubRegistry.pubkey, hubRegistry.sig);
  rwtor.write(req.serialize());
  const bytes = await rwtor.read(timeout);
  const resp = GetMerkleProofResp.deserialize(bytes);
  if (resp.merkleProof.leaf !== hubRegistry.hash()) {
    logger.debug("sendGetMerkleProofReq: mismatch");
    throw new RequestFailed("response mismatches the request");
  }
  logger.debug("sendGetMerkleProofReq: succeeds");
  rwtor.close();
  return resp;
};
