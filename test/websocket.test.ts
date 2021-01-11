import WebSocket from "ws";
import * as http from "http";

import { BaseServer, connect, WebSocketAsyncReadWriter }  from '../src/websocket';
import { TimeoutError } from "../src/exceptions";

const timeout = 100;

class TestServer extends BaseServer {
    onIncomingConnection(
        socket: WebSocket,
        request: http.IncomingMessage
    ) {
        socket.onmessage = event => {
            setTimeout(() => {
                socket.send(event.data);
            }, timeout + 1);
        }
    }
}

describe('TestServer', () => {
    let server: TestServer;
    const ip = 'localhost';
    let port: number;

    beforeAll(async () => {
        server = new TestServer();
        await server.start();
        port = server.address.port;
    });

    afterAll(() => {
        server.close();
    });

    test('Send and receive', async () => {
        const s = new WebSocketAsyncReadWriter(await connect(ip, port));
        const data1 = new Uint8Array([55, 66]);
        const data2 = new Uint8Array([77, 88]);
        s.send(data1);
        s.send(data2);
        expect(await s.read()).toEqual(data1);
        expect(await s.read()).toEqual(data2);
    });

    test('timeout should work', async () => {
        const s = new WebSocketAsyncReadWriter(await connect(ip, port));
        const data1 = new Uint8Array([55, 66]);
        s.send(data1);
        await expect(s.read(timeout)).rejects.toThrow(TimeoutError);
    });

});
