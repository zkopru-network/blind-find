import {
  hubRegistryTreeFactory,
  hubRegistryFactory,
  adminAddressFactory
} from "../src/factories";
import { DataProviderServer, sendGetMerkleProofReq } from "../src/dataProvider";
import { genKeypair, Keypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistry, HubRegistryTree } from "../src";
import WebSocket from "ws";
import { ValueError } from "../src/exceptions";
import { TEthereumAddress } from "../src/types";
import { pubkeyFactoryExclude } from "./utils";

describe("DataProviderServer", () => {
  let dataProvider: DataProviderServer;
  let hub: Keypair;
  let adminAddress: TEthereumAddress;
  let tree: HubRegistryTree;
  let hubRegistry: HubRegistry;
  let ip: string;
  let port: number;

  beforeAll(async () => {
    hub = genKeypair();
    adminAddress = adminAddressFactory();
    tree = hubRegistryTreeFactory([hub], LEVELS, adminAddress);
    expect(tree.length).toEqual(1);
    hubRegistry = tree.leaves[0];
    dataProvider = new DataProviderServer(adminAddress, tree, {
      numAccess: 1000,
      refreshPeriod: 100000
    });
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
    const validRegistry = hubRegistryFactory();
    const anotherPubkey = pubkeyFactoryExclude([validRegistry.pubkey]);
    const invalidHubRegistry = new HubRegistry(
      validRegistry.sig,
      anotherPubkey,
      validRegistry.adminAddress
    );
    await expect(
      sendGetMerkleProofReq(ip, port, invalidHubRegistry)
    ).rejects.toThrowError(ValueError);
  });

  test("request fails when no registry matches", async () => {
    const randomValidRegistry = hubRegistryFactory();
    await expect(
      sendGetMerkleProofReq(ip, port, randomValidRegistry)
    ).rejects.toBeTruthy();
  });

  test("send request", async () => {
    await sendGetMerkleProofReq(ip, port, hubRegistry);
  });

  test("requests fail when rate limit is reached", async () => {
    const ip = "localhost";
    const dataProvider = new DataProviderServer(adminAddress, tree, {
      numAccess: 1,
      refreshPeriod: 100000
    });
    await dataProvider.start();
    const port = (dataProvider.address as WebSocket.AddressInfo).port;
    // Use up the `numAccess`.
    await sendGetMerkleProofReq(ip, port, hubRegistry);
    // Fails because the rate limit is reached.
    await expect(
      sendGetMerkleProofReq(ip, port, hubRegistry)
    ).rejects.toBeTruthy();
    await dataProvider.close();
  });
});
