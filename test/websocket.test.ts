import WebSocket from "ws";
import * as http from "http";

import {
  BaseServer,
  connect,
  WebSocketAsyncReadWriter
} from "../src/websocket";
import { TimeoutError } from "../src/exceptions";

const timeout = 100;

class TestServer extends BaseServer {
  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    socket.onmessage = event => {
      setTimeout(() => {
        socket.send(event.data);
      }, timeout + 1);
    };
  }
}

class FaultyServer extends BaseServer {
  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    socket.onmessage = event => {
      socket.close();
    };
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
    const s = new WebSocketAsyncReadWriter(await connect(ip, port));
    const data1 = new Uint8Array([55, 66]);
    const data2 = new Uint8Array([77, 88]);
    s.write(data1);
    s.write(data2);
    expect(await s.read()).toEqual(data1);
    expect(await s.read()).toEqual(data2);
  });

  test("timeout should work", async () => {
    const s = new WebSocketAsyncReadWriter(await connect(ip, port));
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    await expect(s.read(timeout)).rejects.toThrowError(TimeoutError);
  });

  test("read throws when no messages available and remote closed", async () => {
    const faultyServer = new FaultyServer();
    await faultyServer.start();
    const s = new WebSocketAsyncReadWriter(
      await connect(ip, faultyServer.address.port)
    );
    const data1 = new Uint8Array([55, 66]);
    s.write(data1);
    // `read` doesn't throw an Error. We need to check truth value instead.
    //  Ref: https://github.com/facebook/jest/issues/1700#issuecomment-477393675
    await expect(s.read()).rejects.toBeTruthy();

    faultyServer.close();
  });
});
