import * as http from "http";
import express from "express";
import WebSocket from "isomorphic-ws";
import { AsyncEvent } from "./utils";
import { ServerNotRunning } from "./exceptions";
import { logger } from "./logger";
import { IWebSocketReadWriter, WebSocketAsyncReadWriter } from "./websocket";

export abstract class BaseServer {
  abstract name: string;
  isRunning: boolean;
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;

  constructor() {
    this.isRunning = false;
  }

  abstract async onIncomingConnection(
    socket: IWebSocketReadWriter,
    request: http.IncomingMessage
  ): Promise<void>;

  public get address(): WebSocket.AddressInfo {
    if (this.wsServer === undefined) {
      throw new ServerNotRunning();
    }
    return this.wsServer.address() as WebSocket.AddressInfo;
  }

  async start(port?: number, hostname?: string) {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const event = new AsyncEvent();
    const app = express();
    // TODO: Change to https.
    let webServer: http.Server;
    const newConnectionCB = () => {
      if (webServer.address() === null) {
        throw new Error("address shouldn't be null");
      }
      const port = (webServer.address() as WebSocket.AddressInfo).port;
      logger.info(`${this.name}: Listening on port ${port}`);
      event.set();
    };
    if (port === undefined) {
      webServer = app.listen(newConnectionCB);
    } else if (hostname === undefined) {
      webServer = app.listen(port, newConnectionCB);
    } else {
      webServer = app.listen(port, hostname, newConnectionCB);
    }
    const server = new WebSocket.Server({ server: webServer });
    // Wait until the websocket server is already listening.
    await event.wait();
    this.httpServer = webServer;
    this.wsServer = server;
    const handler = async (
      socket: WebSocket,
      request: http.IncomingMessage
    ): Promise<void> => {
      const rwtor = new WebSocketAsyncReadWriter(socket);
      await this.onIncomingConnection(rwtor, request);
    };
    this.wsServer.on("connection", handler.bind(this));
  }

  async waitClosed() {
    return new Promise((res, rej) => {
      if (this.wsServer === undefined) {
        rej(new Error("ws server is not listened"));
      } else {
        this.wsServer.on("close", () => {
          res();
        });
      }
    });
  }

  close() {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    if (this.httpServer === undefined || this.wsServer === undefined) {
      throw new Error("both httpServer and server should have been set");
    }
    for (const conn of this.wsServer.clients) {
      conn.close();
    }
    this.wsServer.close();
    this.httpServer.close();
  }
}
