import { genKeypair } from "maci-crypto";
import WebSocket from "ws";
import { verifyProofIndirectConnection } from "../src/circuits/ts";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import { MemoryDB } from "../src/db";
import { adminAddressFactory, hubRegistryTreeFactory } from "../src/factories";
import { HubServer } from "../src/hub";
import { User } from "../src/user";

import { expect } from "chai";

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 2;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;

describe("User", function() {
  this.timeout(timeoutTotal);

  const adminAddress = adminAddressFactory();
  const hubKeypair = genKeypair();
  const tree = hubRegistryTreeFactory([hubKeypair], LEVELS, adminAddress);
  expect(tree.length).to.eql(1);
  const hubRegistry = tree.leaves[0];
  const merkleProof = tree.tree.genMerklePath(0);
  const rateLimit = {
    numAccess: 1000,
    refreshPeriod: 100000
  };
  const hub = new HubServer(
    hubKeypair,
    hubRegistry,
    merkleProof,
    rateLimit,
    rateLimit,
    rateLimit,
    new MemoryDB()
  );
  let ip: string;
  let port: number;

  const userJoinedDB = new MemoryDB();
  const userJoined = new User(
    genKeypair(),
    adminAddress,
    merkleProof.root,
    userJoinedDB
  );
  const userAnother = new User(
    genKeypair(),
    adminAddress,
    merkleProof.root,
    new MemoryDB()
  );

  before(async () => {
    await hub.start();

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
      merkleProof.root,
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
    expect(await verifyProofIndirectConnection(proof)).to.be.true;
    // Search fails
    const keypairNotFound = genKeypair();
    expect(await userAnother.search(ip, port, keypairNotFound.pubKey)).to.be
      .null;
  });
});
