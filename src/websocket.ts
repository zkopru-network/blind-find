import * as http from "http";
import express from "express";
import WebSocket from "ws";
import { AsyncEvent } from "./utils";
import { ServerNotRunning, RequestFailed, TimeoutError, ConnectionClosed } from "./exceptions";
import { TIMEOUT, WS_PROTOCOL } from "./configs";

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

  public get address(): WebSocket.AddressInfo {
    if (this.wsServer === undefined) {
      throw new ServerNotRunning();
    }
    return this.wsServer.address() as WebSocket.AddressInfo;
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

const waitForSocketOpen = async (s: WebSocket) => {
  await new Promise(resolve => s.once("open", resolve));
};

export const connect = async (ip: string, port: number) => {
  const ws = new WebSocket(`${WS_PROTOCOL}://${ip}:${port}`);
  await waitForSocketOpen(ws);
  return ws;
};

export const request = async (
  s: WebSocket,
  requestData: Uint8Array | undefined,
  timeout: number
): Promise<Uint8Array> => {
  return await new Promise((res, rej) => {
    const t = setTimeout(() => {
      rej(new TimeoutError("timeout before receiving data"));
    }, timeout);
    // Register handlers before sending data, in case servers respond faster than us
    //  registering the listners.
    s.onmessage = event => {
      clearTimeout(t);
      res(event.data as Buffer);
    };
    s.onclose = event => {
      clearTimeout(t);
      rej(new RequestFailed("socket is closed before receiving response"));
    };
    s.onerror = event => {
      clearTimeout(t);
      rej(new RequestFailed("error occurs before receiving response"));
    };
    if (requestData !== undefined) {
      s.send(requestData);
    }
  });
};

interface ICallback<T> {
  resolvePromise(t: T): void;
  rejectPromise(reason?: any);
  cancelTimeout(): void;
}

export interface IReadWriter {
  read(timeout?: number): Promise<Uint8Array>;
  send(data: Uint8Array): void;
  close(): void;
}

// NOTE: Reference: https://github.com/jcao219/websocket-async/blob/master/src/websocket-client.js.
export class WebSocketAsyncReadWriter implements IReadWriter {
  private closeEvent?: WebSocket.CloseEvent;
  private received: Array<Uint8Array>;
  private callbackQueue: Array<ICallback<Uint8Array>>;

  constructor(readonly socket: WebSocket) {
    this.received = [];
    this.callbackQueue = [];

    this.setupListeners();
  }

  get connected(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  private setupListeners() {
    const socket = this.socket;

    socket.onmessage = event => {
      if (this.callbackQueue.length !== 0) {
        const callback = this.callbackQueue.shift();
        if (callback === undefined) {
          throw new Error('should never happen');
        }
        callback.resolvePromise(new Uint8Array(event.data as Buffer));
        callback.cancelTimeout();
      } else {
        this.received.push(new Uint8Array(event.data as Buffer));
      }
    };

    socket.onclose = event => {
      this.closeEvent = event;

      // Whenever a close event fires, the socket is effectively dead.
      // It's impossible for more messages to arrive.
      // If there are any promises waiting for messages, reject them.
      while (this.callbackQueue.length !== 0) {
        const callback = this.callbackQueue.shift();
        if (callback === undefined) {
          throw new Error('should never happen');
        }
        callback.rejectPromise(this.closeEvent);
        callback.cancelTimeout();
      }
    };
  }

  async read(timeout: number = TIMEOUT): Promise<Uint8Array> {
    if (this.received.length !== 0) {
      const data = this.received.shift();
      if (data === undefined) {
        throw new Error('should never happen');
      }
      return data;
    }

    if (!this.connected) {
      throw new ConnectionClosed();
    }

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new TimeoutError("timeout before receiving data"));
      }, timeout);
      this.callbackQueue.push({
        resolvePromise: resolve,
        rejectPromise: reject,
        cancelTimeout: () => {
          clearTimeout(t);
        },
      });
    });
  }

  send(data: Uint8Array) {
    this.socket.send(data);
  }

  close() {
    if (!this.connected) {
      return;
    }
    this.socket.close();
  }
}
