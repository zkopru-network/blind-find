import WebSocket from "isomorphic-ws";
import { TimeoutError, ConnectionClosed } from "./exceptions";
import { SOCKET_TIMEOUT, WS_PROTOCOL } from "./configs";

export interface IIPRateLimiter {
  allow(ip: string): boolean;
}

type TTokenBucket = { numTokens: number; timestamp: number };
export type TRateLimitParams = { numAccess: number; refreshPeriod: number };

export class TokenBucketRateLimiter implements IIPRateLimiter {
  buckets: Map<string, TTokenBucket>;

  constructor(readonly params: TRateLimitParams) {
    this.buckets = new Map<string, TTokenBucket>();
  }

  /**
   * Allow an IP to access.
   * @param ip IP address to put rate limit on.
   * @returns if the IP address is allowed now or not.
   */
  allow(ip: string): boolean {
    let bucket = this.buckets.get(ip);
    const currentTime = Date.now();
    // If ip is not in the map or it's time to refresh, refresh tokens and return true.
    if (
      bucket === undefined ||
      currentTime - bucket.timestamp > this.params.refreshPeriod
    ) {
      bucket = {
        numTokens: this.params.numAccess,
        timestamp: currentTime
      };
    }
    if (bucket.numTokens > 0) {
      this.buckets.set(ip, {
        numTokens: bucket.numTokens - 1,
        timestamp: bucket.timestamp
      });
      return true;
    } else {
      // No token for the ip available.
      return false;
    }
  }
}

export const connect = async (
  ip: string,
  port: number
): Promise<IWebSocketReadWriter> => {
  const ws = new WebSocket(`${WS_PROTOCOL}://${ip}:${port}`);
  await new Promise((resolve) => {
    function onOpen() {
      resolve(0);
      ws.removeEventListener("open", onOpen);
    }
    ws.onopen = onOpen;
  });
  return new WebSocketAsyncReadWriter(ws);
};

interface ICallback<T> {
  resolvePromise(t: T): void;
  rejectPromise(reason?: any): void;
  cancelTimeout(): void;
}

export interface IWebSocketReadWriter {
  read(timeout?: number): Promise<Uint8Array>;
  write(data: Uint8Array): void;
  close(): void;
  terminate(): void;
}

// NOTE: Reference: https://github.com/jcao219/websocket-async/blob/master/src/websocket-client.js.
export class WebSocketAsyncReadWriter implements IWebSocketReadWriter {
  private closeEvent?: WebSocket.CloseEvent;
  received: Array<Blob | Buffer>;
  private callbackQueue: Array<ICallback<Blob | Buffer>>;

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

    socket.onmessage = async (event) => {
      const data = Buffer.isBuffer(event.data)
        ? (event.data as Buffer)
        : (event.data as any as Blob);

      if (this.callbackQueue.length !== 0) {
        const callback = this.callbackQueue.shift();
        if (callback === undefined) {
          throw new Error("should never happen");
        }
        callback.resolvePromise(data);
        callback.cancelTimeout();
      } else {
        this.received.push(data);
      }
    };

    socket.onclose = (event) => {
      this.closeEvent = event;

      // Whenever a close event fires, the socket is effectively dead.
      // It's impossible for more messages to arrive.
      // If there are any promises waiting for messages, reject them.
      while (this.callbackQueue.length !== 0) {
        const callback = this.callbackQueue.shift();
        if (callback === undefined) {
          throw new Error("should never happen");
        }
        callback.rejectPromise(this.closeEvent);
        callback.cancelTimeout();
      }
    };
  }

  async read(timeout: number = SOCKET_TIMEOUT): Promise<Uint8Array> {
    if (this.received.length !== 0) {
      const data = this.received.shift();
      if (data === undefined) {
        throw new Error("should never happen");
      }
      return new Uint8Array(
        Buffer.isBuffer(data) ? data : await data.arrayBuffer()
      );
    }

    if (!this.connected) {
      throw new ConnectionClosed();
    }

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        reject(
          new TimeoutError(`timeout before receiving data: timeout=${timeout}`)
        );
      }, timeout);
      this.callbackQueue.push({
        resolvePromise: async (data) => {
          resolve(
            new Uint8Array(
              Buffer.isBuffer(data) ? data : await data.arrayBuffer()
            )
          );
        },
        rejectPromise: reject,
        cancelTimeout: () => {
          clearTimeout(t);
        }
      });
    });
  }

  write(data: Uint8Array) {
    this.socket.send(data);
  }

  close(code?: number, data?: string): void {
    if (!this.connected) {
      return;
    }
    this.socket.close(code, data);
  }

  terminate(): void {
    if (!this.connected) {
      return;
    }
    this.socket.terminate();
  }
}
