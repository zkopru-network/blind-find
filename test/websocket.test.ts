import * as http from "http";

import {
  BaseServer,
  connect,
  IWebSocketReadWriter,
  TokenBucketRateLimiter
} from "../src/websocket";
import { TimeoutError } from "../src/exceptions";

const timeout = 100;

class TestServer extends BaseServer {
  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    const data = await rwtor.read();
    await new Promise((res, rej) => {
      setTimeout(() => {
        res();
      }, timeout + 1);
    });
    await rwtor.write(data);
  }
}

class FaultyServer extends BaseServer {
  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    await rwtor.read();
    rwtor.close();
  }
}

describe("TestServer", () => {
  let server: TestServer;
  const ip = "localhost";
  let port: number;

  beforeAll(async () => {
    server = new TestServer();
    await server.start();
    port = server.address.port;
  });

  afterAll(() => {
    server.close();
  });

  test("Send and receive", async () => {
    const s = await connect(ip, port);
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    expect(await s.read()).toEqual(data1);
  });

  test("timeout should work", async () => {
    const s = await connect(ip, port);
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    await expect(s.read(timeout)).rejects.toThrowError(TimeoutError);
  });

  test("read throws when no messages available and remote closed", async () => {
    const faultyServer = new FaultyServer();
    await faultyServer.start();
    const s = await connect(ip, faultyServer.address.port);
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    // `read` doesn't throw an Error. We need to check truth value instead.
    //  Ref: https://github.com/facebook/jest/issues/1700#issuecomment-477393675
    await expect(s.read()).rejects.toBeTruthy();

    faultyServer.close();
  });
});

describe("TokenBucketRateLimiter", () => {
  const ip0 = "127.0.0.1";
  const ip1 = "192.168.0.1";
  const ip2 = "140.112.30.35";

  test("numTokens", () => {
    const numAccess = 2;
    const refreshPeriod = 10000000;
    const rl = new TokenBucketRateLimiter({ numAccess, refreshPeriod });

    // token left of ip0 = 1
    expect(rl.allow(ip0)).toBeTruthy();
    // token left of ip0 = 0
    expect(rl.allow(ip0)).toBeTruthy();
    // rejected
    expect(rl.allow(ip0)).toBeFalsy();

    // different IPs are independent.
    expect(rl.allow(ip1)).toBeTruthy();
    expect(rl.allow(ip2)).toBeTruthy();
    expect(rl.allow(ip1)).toBeTruthy();
    expect(rl.allow(ip2)).toBeTruthy();
    // tokens of ip1 and ip2 are used up.
    expect(rl.allow(ip1)).toBeFalsy();
    expect(rl.allow(ip2)).toBeFalsy();
  });

  test("refresh period", async () => {
    const numAccess = 2;
    const refreshPeriod = 100;
    const rl = new TokenBucketRateLimiter({ numAccess, refreshPeriod });

    expect(rl.allow(ip0)).toBeTruthy();
    expect(rl.allow(ip0)).toBeTruthy();
    // rejected
    expect(rl.allow(ip0)).toBeFalsy();

    // Sleep `refreshPeriod` ms.
    await new Promise((res, rej) => {
      setTimeout(() => {
        res();
      }, refreshPeriod);
    });

    expect(rl.allow(ip0)).toBeTruthy();
  });
});
