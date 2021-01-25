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

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

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

  before(async () => {
    hub = genKeypair();
    adminAddress = adminAddressFactory();
    atomicDB = new MemoryDB();
    tree = new HubRegistryTree(LEVELS);
    treeDB = new HubRegistryTreeDB(tree, atomicDB);
    hubRegistry = hubRegistryFactory(hub, adminAddress);
    await treeDB.insert(hubRegistry);
    expect(tree.length).to.eql(1);
    dataProvider = new DataProviderServer(adminAddress, treeDB, {
      numAccess: 1000,
      refreshPeriod: 100000
    });
    await dataProvider.start();
    const addr = dataProvider.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  after(() => {
    dataProvider.close();
  });

  it("treeDB persistence", async () => {
    const treeDBFromDB = await HubRegistryTreeDB.fromDB(atomicDB, LEVELS);
    expect(treeDBFromDB.tree.length).to.eql(treeDB.tree.length);
    for (const index in treeDBFromDB.tree.leaves) {
      const leafOrig = treeDB.tree.leaves[index];
      const leafFromDB = treeDBFromDB.tree.leaves[index];
      expect(leafOrig.hash()).to.eql(leafFromDB.hash());
    }
  });

  it("request fails when registry is invalid", async () => {
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
    ).to.be.rejectedWith(ValueError);
  });

  it("request fails when no registry matches", async () => {
    const randomValidRegistry = hubRegistryFactory();
    await expect(sendGetMerkleProofReq(ip, port, randomValidRegistry)).to.be
      .rejected;
  });

  it("send request", async () => {
    await sendGetMerkleProofReq(ip, port, hubRegistry);
  });

  it("requests fail when rate limit is reached", async () => {
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
    await expect(sendGetMerkleProofReq(ip, port, hubRegistry)).to.be.rejected;

    dataProvider.close();
  });
});
