import * as http from "http";
import { AddressInfo } from "ws";

import { HubRegistry, HubRegistryTree } from "./";
import { TIMEOUT } from "./configs";
import { RequestFailed, ValueError } from "./exceptions";
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

// TODO: Persistance
export class DataProviderServer extends BaseServer {
  rateLimiter: IIPRateLimiter;

  constructor(
    readonly adminAddress: TEthereumAddress,
    readonly tree: HubRegistryTree,
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
    console.info(`DataProviderServer: new incoming connection from ${ip}`);
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
    const index = this.tree.getIndex(hubRegistry);
    console.debug(
      `DataProviderServer: received req: ${req.hubPubkey}, index=${index}`
    );
    if (index === undefined) {
      // Not Found.
      rwtor.terminate();
      return;
    }
    const merkleProof = this.tree.tree.genMerklePath(index);
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
    console.debug("sendGetMerkleProofReq: mismatch");
    throw new RequestFailed("response mismatches the request");
  }
  console.debug("sendGetMerkleProofReq: succeeds");
  rwtor.close();
  return resp;
};
