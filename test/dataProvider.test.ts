import { hubRegistryTreeFactory, hubRegistryFactory } from "../src/factories";
import { DataProviderServer, sendGetMerkleProofReq } from "../src/dataProvider";
import { genKeypair, Keypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistry, HubRegistryTree } from "../src";
import WebSocket from "ws";
import { RequestFailed, ValueError } from "../src/exceptions";

describe("DataProviderServer", () => {
  let dataProvider: DataProviderServer;
  let hub: Keypair;
  let admin: Keypair;
  let tree: HubRegistryTree;
  let hubRegistry: HubRegistry;
  let ip: string;
  let port: number;

  beforeAll(async () => {
    hub = genKeypair();
    admin = genKeypair();
    tree = hubRegistryTreeFactory([hub], LEVELS, admin);
    expect(tree.length).toEqual(1);
    hubRegistry = tree.leaves[0];
    dataProvider = new DataProviderServer(admin.pubKey, tree);
    await dataProvider.start();

    const addr = dataProvider.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  afterAll(() => {
    dataProvider.close();
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

  test("send request", async () => {
    await sendGetMerkleProofReq(ip, port, hubRegistry);
  });
});
