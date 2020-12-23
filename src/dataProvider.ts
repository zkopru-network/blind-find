import * as http from "http";
import { PubKey } from "maci-crypto";
import WebSocket from "ws";

import { HubRegistry, HubRegistryTree } from "./";
import { TIMEOUT } from "./configs";
import { RequestFailed, ValueError } from "./exceptions";
import { GetMerkleProofReq, GetMerkleProofResp } from "./serialization";
import {
  BaseServer,
  WS_PROTOCOL,
  request,
  waitForSocketOpen
} from "./websocket";

// TODO: Persistance
export class DataProviderServer extends BaseServer {
  constructor(readonly adminPubkey: PubKey, readonly tree: HubRegistryTree) {
    super();
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    console.log(`DataProviderServer: new incoming connection`);
    socket.onmessage = event => {
      const req = GetMerkleProofReq.deserialize(event.data as Buffer);
      const hubRegistry = new HubRegistry(
        req.hubSig,
        req.hubPubkey,
        req.adminSig,
        this.adminPubkey
      );
      if (!hubRegistry.verify()) {
        // Invalid hub registry.
        socket.terminate();
        return;
      }
      // TODO: Naive search. Can be optimized with a hash table.
      const searchRegistry = (target: HubRegistry): number => {
        for (let i = 0; i < this.tree.length; i++) {
          if (this.tree.leaves[i].hash === target.hash) {
            return i;
          }
        }
        return -1;
      };
      const index = searchRegistry(hubRegistry);
      console.log(
        `DataProviderServer: received req: ${req.hubPubkey}, index=${index}`
      );
      if (index === -1) {
        // Not Found.
        socket.terminate();
        return;
      }
      const merkleProof = this.tree.tree.genMerklePath(index);
      const resp = new GetMerkleProofResp(merkleProof);
      socket.send(resp.serialize());
      socket.close();
    };
  }
}

export const sendGetMerkleProofReq = async (
  ip: string,
  port: number,
  hubRegistry: HubRegistry,
  timeout: number = TIMEOUT
): Promise<GetMerkleProofResp> => {
  const c = new WebSocket(`${WS_PROTOCOL}://${ip}:${port}`);
  if (hubRegistry.adminSig === undefined || !hubRegistry.verify()) {
    throw new ValueError("invalid hub registry");
  }
  // Wait until the socket is opened.
  await waitForSocketOpen(c);
  if (hubRegistry.adminSig === undefined) {
    throw new Error("this SHOULD NOT happen because we checked it outside");
  }
  const req = new GetMerkleProofReq(
    hubRegistry.pubkey,
    hubRegistry.sig,
    hubRegistry.adminSig
  );
  const messageHandler = (data: Uint8Array) => {
    const resp = GetMerkleProofResp.deserialize(data);
    if (resp.merkleProof.leaf !== hubRegistry.hash()) {
      console.log("client: mismatch");
      throw new RequestFailed("response mismatches the request");
    }
    console.log("client: succeeds");
    return resp;
  };
  const resp = await request(c, req.serialize(), messageHandler, timeout);
  c.close();
  console.log("client: closed");
  return resp;
};
