import * as http from "http";
import WebSocket from "ws";

import { HubRegistry, HubRegistryTree } from "./";
import { TIMEOUT } from "./configs";
import { RequestFailed, ValueError } from "./exceptions";
import { GetMerkleProofReq, GetMerkleProofResp } from "./serialization";
import { TEthereumAddress } from "./types";
import { BaseServer, connect, WebSocketAsyncReadWriter } from "./websocket";

// TODO: Persistance
export class DataProviderServer extends BaseServer {
  constructor(
    readonly adminAddress: TEthereumAddress,
    readonly tree: HubRegistryTree
  ) {
    super();
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    console.info(`DataProviderServer: new incoming connection`);
    socket.onmessage = event => {
      const req = GetMerkleProofReq.deserialize(event.data as Buffer);
      const hubRegistry = new HubRegistry(
        req.hubSig,
        req.hubPubkey,
        this.adminAddress
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
      console.debug(
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
  const c = await connect(ip, port);
  if (!hubRegistry.verify()) {
    throw new ValueError("invalid hub registry");
  }
  const rwtor = new WebSocketAsyncReadWriter(c);
  const req = new GetMerkleProofReq(hubRegistry.pubkey, hubRegistry.sig);
  rwtor.write(req.serialize());
  const bytes = await rwtor.read(timeout);
  const resp = GetMerkleProofResp.deserialize(bytes);
  if (resp.merkleProof.leaf !== hubRegistry.hash()) {
    console.debug("sendGetMerkleProofReq: mismatch");
    throw new RequestFailed("response mismatches the request");
  }
  console.debug("sendGetMerkleProofReq: succeeds");
  c.close();
  return resp;
};
