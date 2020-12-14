import * as http from "http";

import { HubRegistry, HubRegistryTree } from "./";
import { ServerNotRunning } from "./exceptions";
import { GetMerkleProofReq, GetMerkleProofResp } from "./serialization";
import { Server } from "./websocket";

// TODO: Persistance
export class DataProvider {
  wss: Server;

  constructor(
    readonly adminPubkey,
    readonly tree: HubRegistryTree,
    wss: Server
  ) {
    this.wss = wss;
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    socket.onmessage = event => {
      console.log(`DataProvider: onmessage`);
      const req = GetMerkleProofReq.deserialize(event.data);
      const hubRegistry = new HubRegistry(
        req.hubSig,
        req.hubPubkey,
        req.adminSig,
        this.adminPubkey
      );
      if (!hubRegistry.verify()) {
        // Invalid hub registry. TODO: Socket closed.
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
        `DataProvider: received req: ${req.hubPubkey}, index=${index}`
      );
      if (index === -1) {
        // Not Found. TODO: Socket closed.
        return;
      }
      const merkleProof = this.tree.tree.genMerklePath(index);
      const resp = new GetMerkleProofResp(merkleProof);
      socket.send(resp.serialize());
    };
  }

  async start(port?: number) {
    await this.wss.start(port);
    // Register handlers
    if (this.wss.wsServer === undefined) {
      throw new ServerNotRunning("websocket server is not running");
    }
    this.wss.wsServer.on("connection", this.onIncomingConnection.bind(this));
  }

  close() {
    this.wss.close();
  }
}
