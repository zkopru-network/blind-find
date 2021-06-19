import {
  adminAddressFactory,
  hubConnectionRegistryFactory,
  hubRegistryTreeFactory,
  signedJoinMsgFactory
} from "./factories";
import {
  HubServer,
  sendJoinHubReq,
  sendSearchReq,
  UserStore,
  THubRateLimit, HubConnectionRegistryStore, THubConnectionWithProof
} from "../src/hub";
import { genKeypair, Signature } from "maci-crypto";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import WebSocket from "ws";
import { TimeoutError } from "../src/exceptions";
import { connect } from "../src/websocket";
import { Short, TLV } from "../src/smp/serialization";
import { MemoryDB } from "../src/db";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { HubConnectionRegistryTree } from "../src";
import { verifyProofSaltedConnection } from "../src/circuits";

chai.use(chaiAsPromised);
const expect = chai.expect;

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 4;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;

type TRegistry = { userSig: Signature; hubSig: Signature };
const isRegistrySignedMsgMatch = (
  registry: TRegistry,
  signedMsg: TRegistry
) => {
  expect(registry.userSig).to.eql(signedMsg.userSig);
  expect(registry.hubSig).to.eql(signedMsg.hubSig);
};

describe("UserStore", () => {
  const db = new MemoryDB();
  const userStore = new UserStore(db);
  const msgs = [signedJoinMsgFactory(), signedJoinMsgFactory()];

  it("set, get, and size succeed when adding reigstry", async () => {
    await userStore.set(msgs[0].userPubkey, {
      userSig: msgs[0].userSig,
      hubSig: msgs[0].hubSig
    });
    expect(await userStore.getLength()).to.eql(1);
    const registry = await userStore.get(msgs[0].userPubkey);
    if (!registry) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registry, msgs[0]);
    await userStore.set(msgs[1].userPubkey, {
      userSig: msgs[1].userSig,
      hubSig: msgs[1].hubSig
    });
    expect(await userStore.getLength()).to.eql(2);
    const registryAnother = await userStore.get(msgs[1].userPubkey);
    if (!registryAnother) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registryAnother, msgs[1]);
  });

  it("userStore is an Iterable", async () => {
    const a: any[] = [];
    for await (const item of userStore) {
      a.push(item);
    }
    expect(a.length).to.eql(await userStore.getLength());
  });

  it("get fails when no matched entry", async () => {
    const anotherUser = genKeypair();
    expect(await userStore.get(anotherUser.pubKey)).to.be.undefined;
  });
});

describe("HubConnectionRegistryStore", () => {
  const db = new MemoryDB();
  const hubConnectionStore = new HubConnectionRegistryStore(db);
  const hub0 = genKeypair();
  const hub1 = genKeypair();
  const hub2 = genKeypair();
  const hubConnections = [
    hubConnectionRegistryFactory(hub0, hub1),
    hubConnectionRegistryFactory(hub0, hub2),
  ];
  const fakeNetAddr = {
    host: 'localhost',
    port: 5566,
  }
  const hubConnectionRegistryTree = new HubConnectionRegistryTree();
  hubConnectionRegistryTree.insert(hubConnections[0]);
  hubConnectionRegistryTree.insert(hubConnections[1]);
  const hubConnectionRegistryWithProof1: THubConnectionWithProof = {
    hubConnection: hubConnections[0].toObj(),
    merkleProof: hubConnectionRegistryTree.tree.genMerklePath(0),
    address: fakeNetAddr
  };
  const hubConnectionRegistryWithProof2: THubConnectionWithProof = {
    hubConnection: hubConnections[1].toObj(),
    merkleProof: hubConnectionRegistryTree.tree.genMerklePath(1),
    address: fakeNetAddr
  };

  it("set, get, and size succeed when adding reigstry", async () => {
    await hubConnectionStore.set(hub1.pubKey, hubConnectionRegistryWithProof1);
    expect(await hubConnectionStore.getLength()).to.eql(1);
    const registry = await hubConnectionStore.get(hub1.pubKey);
    if (!registry) {
      throw new Error("should not be undefined");
    }
    await hubConnectionStore.set(hub2.pubKey, hubConnectionRegistryWithProof2);
    expect(await hubConnectionStore.getLength()).to.eql(2);
    const registryAnother = await hubConnectionStore.get(hub2.pubKey);
    if (!registryAnother) {
      throw new Error("should not be undefined");
    }
  });

  it("HubConnectionRegistryStore is an Iterable", async () => {
    const a: any[] = [];
    for await (const item of hubConnectionStore) {
      a.push(item);
    }
    expect(a.length).to.eql(await hubConnectionStore.getLength());
  });

  it("get fails when no matched entry", async () => {
    const anotherUser = genKeypair();
    expect(await hubConnectionStore.get(anotherUser.pubKey)).to.be.undefined;
  });
});

describe("HubServer", function() {
  this.timeout(timeoutTotal);

  // NOTE: We only have **one** hub server in our tests. This means the order of the
  //  following tests matters. The server should be alive until the end of the final
  //  test (which should be closed in `after`).
  let hub0: HubServer;
  let hub1: HubServer;
  let addr0: { host: string, port: number };
  let addr1: { host: string, port: number };
  const hubKeypair0 = genKeypair();
  const hubKeypair1 = genKeypair();
  const adminAddress = adminAddressFactory();
  const user1 = genKeypair();
  const user2 = genKeypair();
  const user3 = genKeypair();
  const tree = hubRegistryTreeFactory([hubKeypair0, hubKeypair1], LEVELS, adminAddress);
  expect(tree.length).to.eql(2);
  const hubRegistry0 = tree.leaves[0];
  const merkleProof0 = tree.tree.genMerklePath(0);

  before(async () => {
    const rateLimit = {
      numAccess: 1000,
      refreshPeriod: 100000
    };
    const hubRateLimit = {
      join: rateLimit,
      search: rateLimit,
      global: rateLimit,
    }
    // Setup hub0
    const db0 = new MemoryDB();
    await HubServer.setHubRegistryToDB(db0, {
      hubRegistry: hubRegistry0.toObj(),
      merkleProof: merkleProof0
    });
    hub0 = new HubServer(
      hubKeypair0,
      adminAddress,
      hubRateLimit,
      db0
    );
    await hub0.start();

    // Setup hub1
    const db1 = new MemoryDB();
    await HubServer.setHubRegistryToDB(db1, {
      hubRegistry: hubRegistry0.toObj(),
      merkleProof: merkleProof0
    });
    hub1 = new HubServer(
      hubKeypair1,
      adminAddress,
      hubRateLimit,
      db1
    );
    await hub1.start();

    const localhost = 'localhost';
    addr0 = {
      host: localhost,
      port: (hub0.address as WebSocket.AddressInfo).port
    };
    addr1 = {
      host: localhost,
      port: (hub1.address as WebSocket.AddressInfo).port
    };
  });

  after(() => {
    hub0.close();
    hub1.close();
  });

  it("request fails when message has unsupported RPC type", async () => {
    // Invalid registry because of the wrong pubkey
    const expectedUnsupportedType = 5566;
    const c = await connect(addr0.host, addr0.port);
    const tlv = new TLV(new Short(expectedUnsupportedType), new Uint8Array());
    c.write(tlv.serialize());
    await expect(c.read()).to.be.rejected;
  });

  it("`Join` request should succeed with correct request data", async () => {
    const signedMsg = signedJoinMsgFactory(user1, hubKeypair0);
    await sendJoinHubReq(
      addr0.host,
      addr0.port,
      signedMsg.userPubkey,
      signedMsg.userSig,
      signedMsg.hubPubkey
    );
    expect(await hub0.userStore.getLength()).to.eql(1);
    expect(hub0.userStore.get(signedMsg.userPubkey)).not.to.be.undefined;

    // Another request

    const signedMsgAnother = signedJoinMsgFactory(user2, hubKeypair0);
    await sendJoinHubReq(
      addr0.host,
      addr0.port,
      signedMsgAnother.userPubkey,
      signedMsgAnother.userSig,
      signedMsgAnother.hubPubkey
    );
    expect(await hub0.userStore.getLength()).to.eql(2);
    expect(hub0.userStore.get(signedMsgAnother.userPubkey)).not.to.be.undefined;
  });

  // it("search succeeds", async () => {
  //   const searchRes = await sendSearchReq(addr0.host, addr0.port, user1.pubKey);
  //   expect(searchRes).not.to.be.undefined;
  // });

  // it("search fails when target is not found", async () => {
  //   const anotherUser = genKeypair();
  //   const searchRes = await sendSearchReq(addr0.host, addr0.port, anotherUser.pubKey);
  //   expect(searchRes).to.be.undefined;
  // });

  it("genProofSaltedConnection succeeds", async () => {
    const hubKeypair1 = genKeypair();
    const hubConnection = hubConnectionRegistryFactory(hubKeypair0, hubKeypair1);
    const hubConnectionRegistryTree = new HubConnectionRegistryTree();
    hubConnectionRegistryTree.insert(hubConnection);
    const hubConnectionRegistryWithProof1: THubConnectionWithProof = {
      hubConnection: hubConnection.toObj(),
      merkleProof: hubConnectionRegistryTree.tree.genMerklePath(0),
      address: addr1,
    };
    await hub0.setHubConnectionRegistry(
      hubKeypair1.pubKey,
      hubConnectionRegistryWithProof1
    );
    const proof = await hub0.genProofSaltedConnection(hubKeypair1.pubKey, hubConnectionRegistryWithProof1);
    expect(await verifyProofSaltedConnection(proof)).to.be.true;
  });

  // Hub1 connection is set in hub0 in the previous test 'genProofSaltedConnection succeeds'.
  it("search succeeds via hub connections", async () => {
    // User3 join hub1
    const signedMsg = signedJoinMsgFactory(user3, hubKeypair1);
    await sendJoinHubReq(
      addr1.host,
      addr1.port,
      signedMsg.userPubkey,
      signedMsg.userSig,
      signedMsg.hubPubkey
    );
    expect(await hub1.userStore.getLength()).to.eql(1);
    expect(hub1.userStore.get(signedMsg.userPubkey)).not.to.be.undefined;

    //        **Request**
    //            \
    //    User1 - Hub0 <-> Hub1 - User3
    //           /
    //        User2
    const searchRes = await sendSearchReq(addr0.host, addr0.port, user3.pubKey);
    expect(searchRes).not.to.be.undefined;
  });

  it("request fails when timeout", async () => {
    // NOTE: Server still possibly adds the registry in `userStore` because
    //  the request is indeed valid. We can let the server revert if timeout happens.
    //  However, it requires additional designs.
    // Invalid registry because of the wrong pubkey
    const signedMsg = signedJoinMsgFactory(undefined, hubKeypair0);
    const timeoutExpectedToFail = 10;
    await expect(
      sendJoinHubReq(
        addr0.host,
        addr0.port,
        signedMsg.userPubkey,
        signedMsg.userSig,
        signedMsg.hubPubkey,
        timeoutExpectedToFail
      )
    ).to.be.rejectedWith(TimeoutError);
  });

  it("requests fail when rate limit is reached", async () => {
    const hubKeypair = genKeypair();
    const adminAddress = adminAddressFactory();
    const tree = hubRegistryTreeFactory([hubKeypair], LEVELS, adminAddress);
    expect(tree.length).to.eql(1);
    const hubRegistry = tree.leaves[0];
    const merkleProof = tree.tree.genMerklePath(0);

    const createHub = async (rateLimit: THubRateLimit) => {
      const db = new MemoryDB();
      await HubServer.setHubRegistryToDB(db, {
        hubRegistry: hubRegistry.toObj(),
        merkleProof: merkleProof
      });
      const hub0 = new HubServer(
        hubKeypair,
        adminAddress,
        rateLimit,
        db
      );
      await hub0.start();
      const ip = 'localhost';
      const port = hub0.address.port;
      return { hub0, ip, port };
    };

    const zeroRateLimit = { numAccess: 0, refreshPeriod: 100000 };
    const normalRateLimit = { numAccess: 1000, refreshPeriod: 100000 };

    // Put zero rate limit on join requests, thus only join requests fail.
    await (async () => {
      const { hub0, ip, port } = await createHub({
        join: zeroRateLimit,
        search: normalRateLimit,
        global: normalRateLimit,
      });
      const signedMsg = signedJoinMsgFactory(user1, hubKeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          signedMsg.hubPubkey
        )
      ).to.be.rejected;
      // Search succeeds: temporarily comment it out since it's too slow.
      // await sendSearchReq(ip, port, user1.pubKey);
      hub0.close();
    })();

    // Put zero rate limit on search requests, thus only search requests fail.
    await (async () => {
      const { hub0, ip, port } = await createHub({
        join: normalRateLimit,
        search: zeroRateLimit,
        global: normalRateLimit,
      });
      await expect(sendSearchReq(ip, port, user1.pubKey)).to.be.rejected;
      hub0.close();
    })();

    // Put zero rate limit on global, thus any request fails.
    await (async () => {
      const { hub0, ip, port } = await createHub({
        join: normalRateLimit,
        search: normalRateLimit,
        global: zeroRateLimit,
      });
      const signedMsg = signedJoinMsgFactory(user1, hubKeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          signedMsg.hubPubkey
        )
      ).to.be.rejected;
      await expect(sendSearchReq(ip, port, user1.pubKey)).to.be.rejected;
      hub0.close();
    })();
  });

});
