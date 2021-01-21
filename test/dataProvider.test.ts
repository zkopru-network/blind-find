import { hubRegistryFactory, adminAddressFactory } from "../src/factories";
import {
  DataProviderServer,
  sendGetMerkleProofReq,
  HubRegistryTreeDB
} from "../src/dataProvider";
import { genKeypair, Keypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistry, HubRegistryTree } from "../src";
import WebSocket from "ws";
import { ValueError } from "../src/exceptions";
import { TEthereumAddress } from "../src/types";
import { pubkeyFactoryExclude } from "./utils";
import { IAtomicDB } from "../src/interfaces";
import { MemoryDB } from "../src/db";

describe("DataProviderServer", () => {
  let dataProvider: DataProviderServer;
  let tree: HubRegistryTree;
  let treeDB: HubRegistryTreeDB;
  let hub: Keypair;
  let adminAddress: TEthereumAddress;
  let hubRegistry: HubRegistry;
  let ip: string;
  let port: number;
  let atomicDB: IAtomicDB;

  beforeAll(async () => {
    hub = genKeypair();
    adminAddress = adminAddressFactory();
    atomicDB = new MemoryDB();
    tree = new HubRegistryTree(LEVELS);
    treeDB = new HubRegistryTreeDB(tree, atomicDB);
    hubRegistry = hubRegistryFactory(hub, adminAddress);
    await treeDB.insert(hubRegistry);
    expect(tree.length).toEqual(1);
    dataProvider = new DataProviderServer(adminAddress, treeDB, {
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

  test("treeDB persistence", async () => {
    const treeDBFromDB = await HubRegistryTreeDB.fromDB(atomicDB, LEVELS);
    expect(treeDBFromDB.tree.length).toEqual(treeDB.tree.length);
    for (const index in treeDBFromDB.tree.leaves) {
      const leafOrig = treeDB.tree.leaves[index];
      const leafFromDB = treeDBFromDB.tree.leaves[index];
      expect(leafOrig.hash()).toEqual(leafFromDB.hash());
    }
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
    const dataProvider = new DataProviderServer(adminAddress, treeDB, {
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
