import Websocket from "ws";
import { wsServerFactory, hubRegistryTreeFactory } from "../src/factories";
import { Server } from "../src/websocket";
import { AsyncEvent } from "../src/utils";
import { DataProvider } from "../src/dataProvider";
import { genKeypair, Keypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistry, HubRegistryTree } from "../src";
import { GetMerkleProofReq, GetMerkleProofResp } from "../src/serialization";

jest.setTimeout(30000);

describe("test WebSocket.Server and client connect", () => {
  let wsServer: Server;
  let dataProvider: DataProvider;
  let hub: Keypair;
  let admin: Keypair;
  let tree: HubRegistryTree;
  let hubRegistry: HubRegistry;

  beforeAll(async () => {
    wsServer = await wsServerFactory();
    hub = genKeypair();
    admin = genKeypair();
    tree = hubRegistryTreeFactory([hub], LEVELS, admin);
    expect(tree.length).toEqual(1);
    hubRegistry = tree.leaves[0];
    dataProvider = new DataProvider(admin.pubKey, tree, wsServer);
    await dataProvider.start();
  });

  afterAll(() => {
    dataProvider.close();
  });

  test("", async () => {
    if (wsServer.wsServer === undefined) {
      throw new Error();
    }

    const c = new Websocket(
      `ws://localhost:${(wsServer.wsServer.address() as any).port}`
    );

    const msgEvent = new AsyncEvent();
    const closeEvent = new AsyncEvent();
    c.onopen = async event => {
      console.log(`Client: opened connection, event=${event.target}`);
      if (hubRegistry.adminSig === undefined) {
        throw new Error();
      }
      const req = new GetMerkleProofReq(
        hubRegistry.pubkey,
        hubRegistry.sig,
        hubRegistry.adminSig
      );
      c.send(req.serialize());
      c.onmessage = event => {
        const resp = GetMerkleProofResp.deserialize(event.data as Buffer);
        if (resp.merkleProof.leaf !== hubRegistry.hash()) {
          throw new Error("response mismatches the request");
        }
        console.log(
          `Client: received proof from provider, proof=`,
          resp.merkleProof
        );
        msgEvent.set();
      };

      c.onclose = () => {
        closeEvent.set();
      };
    };

    await msgEvent.wait();
    c.close();
    await closeEvent.wait();
  });
});
