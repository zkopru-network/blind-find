import * as express from "express";

import { HubRegistryTree } from "./";
import { WSServer } from "./websocket";

// TODO: Persistance
class DataProvider {
  wss: WSServer;

  constructor(readonly tree: HubRegistryTree, wss: WSServer) {
    this.wss = wss;
  }

  start(port?: number) {
    this.wss.start(port);
    // Register handlers
  }
}

// TODO: Read TLV, map the handle method and messages
