import { genKeypair, Keypair } from "maci-crypto";
import WebSocket from "ws";
import { verifyProofIndirectConnection } from "../src/circuits";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import { MemoryDB } from "../src/db";
import { hubRegistryTreeFactory } from "./factories";
import { HubServer } from "../src/hub";
import { User } from "../src/user";

import { expect } from "chai";
import { BlindFindContract } from "../src/web3";
import { HubRegistryTree } from "../src";
import { blindFindContractFactory } from "./factories";
import { IAtomicDB } from "../src/interfaces";
import { hubRegistryToObj } from "../src/dataProvider";

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 2;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;

// TODO: Use hardhat
describe("User", function() {
  this.timeout(timeoutTotal);

  let hub: HubServer;
  let blindFindContract: BlindFindContract;
  let hubKeypair: Keypair;
  let tree: HubRegistryTree;
  let userJoinedDB: IAtomicDB;
  let userJoined: User;
  let userAnother: User;
  let adminAddress: BigInt;
  const rateLimit = {
    numAccess: 1000,
    refreshPeriod: 100000
  };
  const hubRateLimit = {
    join: rateLimit,
    search: rateLimit,
    global: rateLimit,
  }
  let ip: string;
  let port: number;

  before(async () => {
    // Admin and contract
    blindFindContract = await blindFindContractFactory();
    adminAddress = await blindFindContract.getAdmin();
    // Hub
    hubKeypair = genKeypair();
    tree = hubRegistryTreeFactory([hubKeypair], LEVELS, adminAddress);
    expect(tree.length).to.eql(1);
    const hubRegistry = tree.leaves[0];
    const merkleProof = tree.tree.genMerklePath(0);
    const db = new MemoryDB();
    await HubServer.setHubRegistryToDB(db, {
      hubRegistry: hubRegistryToObj(hubRegistry),
      merkleProof: merkleProof
    });
    hub = new HubServer(
      hubKeypair,
      adminAddress,
      hubRateLimit,
      db
    );
    await hub.start();
    await blindFindContract.updateMerkleRoot(merkleProof.root);
    expect((await blindFindContract.getAllMerkleRoots()).size).to.eql(1);

    // User
    userJoinedDB = new MemoryDB();
    userJoined = new User(
      genKeypair(),
      adminAddress,
      blindFindContract,
      userJoinedDB
    );
    userAnother = new User(
      genKeypair(),
      adminAddress,
      blindFindContract,
      new MemoryDB()
    );

    const addr = hub.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  after(() => {
    hub.close();
  });

  it("join", async () => {
    // Number of joinedHubs is 0 when the database is first initialized.
    expect((await userJoined.getJoinedHubs()).length).to.eql(0);

    // Number of joinedHubs is incremented after joining a hub.
    await userJoined.join(ip, port, hubKeypair.pubKey);
    expect((await userJoined.getJoinedHubs()).length).to.eql(1);

    // Persistence: data should persist in the database
    const userAnother2 = new User(
      genKeypair(),
      adminAddress,
      blindFindContract,
      userJoinedDB
    );
    expect((await userAnother2.getJoinedHubs()).length).to.eql(1);
  });

  it("search", async () => {
    // Search succeeds
    const proof = await userAnother.search(ip, port, userJoined.keypair.pubKey);
    expect(proof).not.to.be.null;
    if (proof === null) {
      // Makes compiler happy
      throw new Error();
    }
    // Ensure the output proof is valid
    const validMerkleRoots = await blindFindContract.getAllMerkleRoots();
    expect(await verifyProofIndirectConnection(proof, validMerkleRoots)).to.be
      .true;
    // Search fails
    const keypairNotFound = genKeypair();
    expect(await userAnother.search(ip, port, keypairNotFound.pubKey)).to.be
      .null;
  });
});
