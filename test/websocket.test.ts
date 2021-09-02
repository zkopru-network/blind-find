import * as http from "http";

import {
  BaseServer,
  connect,
  IWebSocketReadWriter,
  relay,
  TokenBucketRateLimiter
} from "../src/websocket";
import { TimeoutError } from "../src/exceptions";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { AsyncEvent } from "../src/utils";

chai.use(chaiAsPromised);
const expect = chai.expect;

const timeout = 100;

class TestServer extends BaseServer {
  name = "TestServer";

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
    rwtor.write(data);
  }
}

class FaultyServer extends BaseServer {
  name = "FaltyServer";

  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    await rwtor.read();
    rwtor.close();
  }
}

class ServerDoesntCloseSocket extends BaseServer {
  name = "FaltyServer";
  rwtor: IWebSocketReadWriter | undefined = undefined;
  eventConnected: AsyncEvent;

  constructor() {
    super();
    this.rwtor = undefined;
    this.eventConnected = new AsyncEvent();
  }

  async onIncomingConnection(
    rwtor: IWebSocketReadWriter,
    request: http.IncomingMessage
  ) {
    this.rwtor = rwtor;
    this.eventConnected.set();
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
    await expect(s.read(timeout)).to.be.rejectedWith(TimeoutError);
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

  it("relay", async () => {
    // A  < -- >   C   < -- >  B
    //  aToC  cToA  cToB  bToC
    const relayedSocketsFactory = async () => {
      const serverA = new ServerDoesntCloseSocket();
      const serverB = new ServerDoesntCloseSocket();
      await serverA.start();
      await serverB.start();
      const cToA = await connect(ip, serverA.address.port);
      const cToB = await connect(ip, serverB.address.port);

      await serverA.eventConnected.wait();
      const aToC = serverA.rwtor;
      if (aToC === undefined) {
        throw new Error();
      }
      expect(aToC).not.to.be.undefined;

      await serverB.eventConnected.wait();
      const bToC = serverB.rwtor;
      if (bToC === undefined) {
        throw new Error();
      }
      expect(bToC).not.to.be.undefined;

      const eventRelayRun = new AsyncEvent();
      const eventRelayStopped = new AsyncEvent();
      const relayWithEvents = async () => {
        await (async () => {
          eventRelayRun.set();
          await relay(cToA, cToB);
          eventRelayStopped.set();
        })();
      }
      relayWithEvents();
      await eventRelayRun.wait();
      return {
        aToC,
        cToA,
        cToB,
        bToC,
        eventRelayRun,
        eventRelayStopped,
      }
    };

    const sockets0 = await relayedSocketsFactory();
    /*
      Here, messages are relayed and the relay coroutine should stop when either side is closed.
    */
    const data1 = new Uint8Array([1, 2, 3]);
    sockets0.aToC.write(data1);
    const data1BToCRead = await sockets0.bToC.read();
    expect(data1).to.eql(data1BToCRead);

    const data2 = new Uint8Array([4, 5, 6]);
    sockets0.bToC.write(data2);
    const data2AToCRead = await sockets0.aToC.read();
    expect(data2).to.eql(data2AToCRead);

    // Test: when `bToC.close` is called, only sockets related to B are closed.
    sockets0.bToC.close();
    const sleep = async (time: number) => {
      return new Promise((res, rej) => {
        setTimeout(() => {
          res();
        }, time);
      });
    }
    // NOTE: It's just for convenient to sleep 100ms and wait until events occur.
    //  It's generally a bad practice actually which should be replaced by waiting
    //  for some events.
    await sleep(100);
    // bToC and cToB is closed.
    expect(sockets0.bToC.connected).to.be.false;
    expect(sockets0.cToB.connected).to.be.false;
    // cToA and aToC are not closed.
    expect(sockets0.aToC.connected).to.be.true;
    expect(sockets0.cToA.connected).to.be.true;
    // relay coroutine should have finished.
    await sockets0.eventRelayStopped.wait();

    const sockets1 = await relayedSocketsFactory();
    // Test: when `aToC.close` is closed, all sockets should be closed.
    sockets1.aToC.close();
    // NOTE: It's just for convenient to sleep 100ms and wait until events occur.
    //  It's generally a bad practice actually which should be replaced by waiting
    //  for some events.
    await sleep(100);
    expect(sockets1.aToC.connected).to.be.false;
    expect(sockets1.cToA.connected).to.be.false;
    expect(sockets1.cToB.connected).to.be.false;
    expect(sockets1.bToC.connected).to.be.false;
    // relay coroutine should have finished.
    await sockets1.eventRelayStopped.wait();
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
    const refreshPeriod = 200;
    const rl = new TokenBucketRateLimiter({ numAccess, refreshPeriod });

    expect(rl.allow(ip0)).to.be.true;
    expect(rl.allow(ip0)).to.be.true;
    // rejected
    expect(rl.allow(ip0)).to.be.false;

    // Sleep 2* `refreshPeriod` ms, to ensure the limit is refreshed.
    await new Promise((res, rej) => {
      setTimeout(() => {
        res();
      }, refreshPeriod * 2);
    });

    expect(rl.allow(ip0)).to.be.true;
  });
});
