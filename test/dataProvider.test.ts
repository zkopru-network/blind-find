import {
  wsServerFactory,
  hubRegistryTreeFactory,
  hubRegistryFactory
} from "../src/factories";
import { Server } from "../src/websocket";
import { DataProviderServer, sendGetMerkleProofReq } from "../src/dataProvider";
import { genKeypair, Keypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistry, HubRegistryTree } from "../src";
import WebSocket from "ws";
import { RequestFailed, ValueError } from "../src/exceptions";

describe("DataProviderServer", () => {
  let wsServer: Server;
  let dataProvider: DataProviderServer;
  let hub: Keypair;
  let admin: Keypair;
  let tree: HubRegistryTree;
  let hubRegistry: HubRegistry;
  let ip: string;
  let port: number;

  beforeAll(async () => {
    wsServer = await wsServerFactory();
    hub = genKeypair();
    admin = genKeypair();
    tree = hubRegistryTreeFactory([hub], LEVELS, admin);
    expect(tree.length).toEqual(1);
    hubRegistry = tree.leaves[0];
    dataProvider = new DataProviderServer(admin.pubKey, tree, wsServer);
    await dataProvider.start();

    if (wsServer.wsServer === undefined) {
      throw new Error();
    }
    const addr = wsServer.wsServer.address() as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  afterAll(() => {
    dataProvider.close();
  });

  test("send request", async () => {
    await sendGetMerkleProofReq(ip, port, hubRegistry);
  });

  test("request fails when registry is invalid", async () => {
    // Invalid registry because of the wrong pubkey
    const invalidRegistry = hubRegistryFactory();
    invalidRegistry.pubkey = admin.pubKey;
    await expect(
      sendGetMerkleProofReq(ip, port, invalidRegistry)
    ).rejects.toThrowError(ValueError);
  });

  test("request fails when no registry matches", async () => {
    const randomValidRegistry = hubRegistryFactory();
    await expect(
      sendGetMerkleProofReq(ip, port, randomValidRegistry)
    ).rejects.toThrowError(RequestFailed);
  });
});
