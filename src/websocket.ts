import * as http from "http";
import express from "express";
import WebSocket from "ws";
import { AsyncEvent } from "./utils";
import { ServerNotRunning, RequestFailed, TimeoutError } from "./exceptions";

// Should be changed to wss later when we support https
export const WS_PROTOCOL = "ws";

// TODO: Add tests for Server
export abstract class BaseServer {
  isRunning: boolean;
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;

  constructor() {
    this.isRunning = false;
  }

  abstract onIncomingConnection(
    socket: WebSocket,
    request: http.IncomingMessage
  );

  public get address() {
    if (this.wsServer === undefined) {
      throw new ServerNotRunning();
    }
    return this.wsServer.address();
  }

  async start(port?: number) {
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
      console.log(`Listening on port ${port}`);
      event.set();
    };
    if (port === undefined) {
      webServer = app.listen(newConnectionCB);
    } else {
      webServer = app.listen(port, newConnectionCB);
    }
    const server = new WebSocket.Server({ server: webServer });
    // Wait until the websocket server is already listening.
    await event.wait();
    this.httpServer = webServer;
    this.wsServer = server;
    this.wsServer.on("connection", this.onIncomingConnection.bind(this));
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

export const waitForMessage = async <TResponse>(
  s: WebSocket,
  onMessage: (data: Uint8Array) => TResponse,
  timeout: number
) => {
  return (await new Promise((res, rej) => {
    const t = setTimeout(() => {
      rej(new TimeoutError());
    }, timeout);
    s.onmessage = event => {
      clearTimeout(t);
      try {
        const resp = onMessage(event.data as Buffer);
        res(resp);
      } catch (e) {
        rej(e);
      }
    };
    s.onclose = event => {
      clearTimeout(t);
      rej(new RequestFailed("socket is closed before receiving response"));
    };
    s.onerror = event => {
      clearTimeout(t);
      rej(new RequestFailed("error occurs before receiving response"));
    };
  })) as TResponse;
};

export const waitForSocketOpen = async (s: WebSocket) => {
  await new Promise(resolve => s.once("open", resolve));
};