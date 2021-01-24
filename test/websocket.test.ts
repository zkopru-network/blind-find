import * as http from "http";

import {
  BaseServer,
  connect,
  IWebSocketReadWriter,
  TokenBucketRateLimiter
} from "../src/websocket";
import { TimeoutError } from "../src/exceptions";

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const expect = chai.expect;

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

  before(async () => {
    server = new TestServer();
    await server.start();
    port = server.address.port;
  });

  after(() => {
    server.close();
  });

  it("Send and receive", async () => {
    const s = await connect(ip, port);
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    expect(await s.read()).to.eql(data1);
  });

  it("timeout should work", async () => {
    const s = await connect(ip, port);
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    expect(s.read(timeout)).to.be.rejectedWith(TimeoutError);
  });

  it("read throws when no messages available and remote closed", async () => {
    const faultyServer = new FaultyServer();
    await faultyServer.start();
    const s = await connect(ip, faultyServer.address.port);
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    // `read` doesn't throw an Error, but an CloseEvent.
    await expect(s.read()).to.be.rejected;

    faultyServer.close();
  });
});

describe("TokenBucketRateLimiter", () => {
  const ip0 = "127.0.0.1";
  const ip1 = "192.168.0.1";
  const ip2 = "140.112.30.35";

  it("numTokens", () => {
    const numAccess = 2;
    const refreshPeriod = 10000000;
    const rl = new TokenBucketRateLimiter({ numAccess, refreshPeriod });

    // token left of ip0 = 1
    expect(rl.allow(ip0)).to.be.true;
    // token left of ip0 = 0
    expect(rl.allow(ip0)).to.be.true;
    // rejected
    expect(rl.allow(ip0)).to.be.false;

    // different IPs are independent.
    expect(rl.allow(ip1)).to.be.true;
    expect(rl.allow(ip2)).to.be.true;
    expect(rl.allow(ip1)).to.be.true;
    expect(rl.allow(ip2)).to.be.true;
    // tokens of ip1 and ip2 are used up.
    expect(rl.allow(ip1)).to.be.false;
    expect(rl.allow(ip2)).to.be.false;
  });

  it("refresh period", async () => {
    const numAccess = 2;
    const refreshPeriod = 100;
    const rl = new TokenBucketRateLimiter({ numAccess, refreshPeriod });

    expect(rl.allow(ip0)).to.be.true;
    expect(rl.allow(ip0)).to.be.true;
    // rejected
    expect(rl.allow(ip0)).to.be.false;

    // Sleep `refreshPeriod` ms.
    await new Promise((res, rej) => {
      setTimeout(() => {
        res();
      }, refreshPeriod);
    });

    expect(rl.allow(ip0)).to.be.true;
  });
});
