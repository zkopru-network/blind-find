import Websocket from "ws";
import { wsServerFactory } from "../src/factories";
import { WSServer } from "../src/websocket";
import { AsyncEvent } from "./utils";

describe("", () => {
  let wsServer: WSServer;

  beforeAll(() => {
    wsServer = wsServerFactory();
  });

  afterAll(() => {
    wsServer.close();
  });

  test("", async () => {
    if (!wsServer.isRunning) {
      throw new Error();
    }
    if (wsServer.httpServer === undefined || wsServer.wsServer === undefined) {
      throw new Error();
    }
    wsServer.httpServer.on("close", () => {
      console.log("http server: has been closed");
    });
    const data = '0123';

    wsServer.wsServer.on("connection", (socket, request) => {
      console.log(
        `server: received connection, socket=${socket}, request=${request}`
      );
      socket.send(data);
    });
    const c = new Websocket(
      `ws://localhost:${(wsServer.wsServer.address() as any).port}`
    );

    c.onopen = async event => {
      console.log(`client: opened connection, event=${event.target}`);
    };
    const closeEvent = new AsyncEvent();
    c.onclose = () => {
      closeEvent.set();
    };
    const msgEvent = new AsyncEvent();
    c.onmessage = event => {
        expect(data).toEqual(event.data);
        msgEvent.set();
    };

    await msgEvent.wait();
    c.close();
    await closeEvent.wait();
  });
});
