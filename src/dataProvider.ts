import * as http from "http";
import { AddressInfo } from "ws";

import { logger } from "./logger";

import { HubRegistry, THubConnectionObj, THubRegistryObj, IncrementalSMT, ILeafEntry, HubConnectionRegistry, HubRegistryTree, HubConnectionRegistryTree } from "./";
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
import { Scalar } from "./smp/v4/serialization";

const PREFIX_HUB_REGISTRY = "blind-find-data-provider-hub-registry-leaves";
const PREFIX_HUB_CONNECTION = "blind-find-data-provider-hub-connection-leaves";

// Result from `hash` is at most 32 bytes, to hex string it is length 64.
const maxHubRegistryKeyLength = Scalar.size * 2;

class TreeDB<T extends Object> {
  dbMap: IDBMap<T>;

  constructor(readonly tree: IncrementalSMT<T>, dbPrefix: string, db: IAtomicDB) {
    this.dbMap = new DBMap<T>(dbPrefix, db, maxHubRegistryKeyLength);
  }

  private getDBKey(e: ILeafEntry<T>): string {
    const h = e.hash();
    const keyHex = h.toString(16);
    if (keyHex.length > maxHubRegistryKeyLength) {
      throw new Error(
        `keyHex is longer than maxKeyLength: keyHex=${keyHex}, maxKeyLength=${maxHubRegistryKeyLength}`
      );
    }
    return keyHex;
  }

  async insert(e: ILeafEntry<T>) {
    // If hubRegistry already exists in the tree, skip it.
    if (this.getIndex(e) !== undefined) {
      throw new ValueError(`registry ${this.getDBKey(e)} already exists`);
    }
    await this.dbMap.set(this.getDBKey(e), e.toObj());
    this.tree.insert(e);
  }

  getIndex(e: ILeafEntry<T>) {
    return this.tree.getIndex(e);
  }
}

export class HubRegistryTreeDB extends TreeDB<THubRegistryObj> {
  constructor(readonly tree: HubRegistryTree, db: IAtomicDB) {
    super(tree, PREFIX_HUB_REGISTRY, db);
  }
  static async fromDB(db: IAtomicDB, levels = LEVELS) {
    const tree = new HubRegistryTree(levels);
    const dbMap = new DBMap<THubRegistryObj>(PREFIX_HUB_REGISTRY, db, maxHubRegistryKeyLength);
    // Load leaves from DB.
    for await (const l of dbMap) {
      const registry = new HubRegistry(l.value);
      tree.insert(registry);
    }
    return new HubRegistryTreeDB(tree, db);
  }
}

export class HubConnectionRegistryTreeDB extends TreeDB<THubConnectionObj> {
  constructor(readonly tree: HubConnectionRegistryTree, db: IAtomicDB) {
    super(tree, PREFIX_HUB_CONNECTION, db);
  }
  static async fromDB(db: IAtomicDB, levels = LEVELS) {
    const tree = new HubConnectionRegistryTree(levels);
    const dbMap = new DBMap<THubConnectionObj>(PREFIX_HUB_CONNECTION, db, maxHubRegistryKeyLength);
    // Load leaves from DB.
    for await (const l of dbMap) {
      const registry = new HubConnectionRegistry(l.value);
      tree.insert(registry);
    }
    return new HubConnectionRegistryTreeDB(tree, db);
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
    const hubRegistry = new HubRegistry({
      sig: req.hubSig,
      pubkey: req.hubPubkey,
      adminAddress: this.adminAddress
    });
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
  const req = new GetMerkleProofReq(hubRegistry.obj.pubkey, hubRegistry.obj.sig);
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
