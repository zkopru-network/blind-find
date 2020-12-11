import * as http from "http";
import express from "express";
import WebSocket from "ws";

// TODO: Add tests for WSServer
export class WSServer {
  isRunning: boolean;
  httpServer?: http.Server;
  wsServer?: WebSocket.Server;

  constructor() {
    this.isRunning = false;
  }

  start(port?: number) {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const app = express();
    // TODO: Change to https.
    let webServer: http.Server;
    const newConnectionCB = () => {
      if (webServer.address() === null) {
        throw new Error("address shouldn't be null");
      }
      const port = (webServer.address() as WebSocket.AddressInfo).port;
      console.log(`Listening on port ${port}`);
    };
    if (port === undefined) {
      webServer = app.listen(newConnectionCB);
    } else {
      webServer = app.listen(port, newConnectionCB);
    }
    const server = new WebSocket.Server({ server: webServer });
    this.httpServer = webServer;
    this.wsServer = server;
  }

  close() {
    if (!this.isRunning) {
      return;
    }
    if (this.httpServer === undefined || this.wsServer === undefined) {
      throw new Error("both httpServer and server should have been set");
    }
    for (const conn of this.wsServer.clients) {
      conn.close();
    }
    this.wsServer.close();
    this.httpServer.close();
    this.isRunning = false;
  }
}
