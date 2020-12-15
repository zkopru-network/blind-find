import * as http from "http";
import { PubKey } from "maci-crypto";
import WebSocket from "ws";

import { HubRegistry, HubRegistryTree } from "./";
import { ServerNotRunning, RequestFailed, ValueError } from "./exceptions";
import { GetMerkleProofReq, GetMerkleProofResp } from "./serialization";
import { AsyncEvent } from "./utils";
import { Server, WS_PROTOCOL } from "./websocket";

// TODO: Persistance
export class DataProviderServer {
  wss: Server;

  constructor(
    readonly adminPubkey: PubKey,
    readonly tree: HubRegistryTree,
    wss: Server
  ) {
    this.wss = wss;
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    socket.onmessage = event => {
      console.log(`DataProviderServer: onmessage`);
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

export const sendGetMerkleProofReq = async (
  ip: string,
  port: number,
  hubRegistry: HubRegistry
): Promise<GetMerkleProofResp> => {
  const c = new WebSocket(`${WS_PROTOCOL}://${ip}:${port}`);

  const finishedEvent = new AsyncEvent();
  let resp: GetMerkleProofResp | null = null;
  let error: Error | undefined;
  // TODO: Add timeout.

  if (hubRegistry.adminSig === undefined || !hubRegistry.verify()) {
    throw new ValueError("invalid hub registry");
  }
  // Wait until the socket is opened.
  await new Promise(resolve => c.once("open", resolve));
  if (hubRegistry.adminSig === undefined) {
    throw new Error("this SHOULD NOT happen because we checked it outside");
  }
  const req = new GetMerkleProofReq(
    hubRegistry.pubkey,
    hubRegistry.sig,
    hubRegistry.adminSig
  );
  c.send(req.serialize(), err => {
    if (err !== undefined) {
      error = err;
    }
  });
  c.onmessage = event => {
    finishedEvent.set();
    resp = GetMerkleProofResp.deserialize(event.data as Buffer);
    if (resp.merkleProof.leaf !== hubRegistry.hash()) {
      error = new RequestFailed("response mismatches the request");
      return;
    }
    console.log(
      `Client: received proof from provider, proof=`,
      resp.merkleProof
    );
  };
  c.onclose = event => {
    if (!finishedEvent.isSet) {
      // Socket is closed before msg is received.
      // This means there is something wrong.
      error = new RequestFailed("socket is closed before receiving response");
      finishedEvent.set();
    }
  };

  if (error !== undefined) {
    throw new RequestFailed(`request failed: error=${error}`);
  }
  await finishedEvent.wait();
  if (error !== undefined || resp === null) {
    throw new RequestFailed(`request failed: error=${error}, resp=${resp}`);
  }
  c.close();
  return resp;
};
