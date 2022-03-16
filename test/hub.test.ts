import {
  adminAddressFactory,
  hubRegistryTreeFactory,
  signedJoinMsgFactory
} from "./factories";
import { HubServer, UserStore, THubRateLimit } from "../src/hub";
import { sendJoinHubReq, sendSearchReq } from "../src/req";
import { genKeypair, Signature } from "maci-crypto";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import WebSocket from "ws";
import { TimeoutError } from "../src/exceptions";
import { connect } from "../src/websocket";
import { Short, TLV } from "../src/smp/serialization";
import { MemoryDB } from "../src/db";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 4;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;
const host = {
  hostname: "127.0.0.1",
  port: 3333
};

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
      hubSig: msgs[0].hubSig,
      userHost: "127.0.0.1:8080"
    });
    expect(await userStore.getLength()).to.eql(1);
    const registry = await userStore.get(msgs[0].userPubkey);
    if (!registry) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registry, msgs[0]);
    await userStore.set(msgs[1].userPubkey, {
      userSig: msgs[1].userSig,
      hubSig: msgs[1].hubSig,
      userHost: "127.0.0.1:8080"
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

describe("HubServer", function () {
  this.timeout(timeoutTotal);

  // NOTE: We only have **one** hub server in our tests. This means the order of the
  //  following tests matters. The server should be alive until the end of the final
  //  test (which should be closed in `after`).
  let hub: HubServer;
  let ip: string;
  let port: number;
  const hubkeypair = genKeypair();
  const adminAddress = adminAddressFactory();
  const user1 = genKeypair();
  const user2 = genKeypair();
  const tree = hubRegistryTreeFactory([hubkeypair], LEVELS, adminAddress);
  expect(tree.length).to.eql(1);
  const hubRegistry = tree.leaves[0];
  const merkleProof = tree.tree.genMerklePath(0);

  before(async () => {
    const rateLimit = {
      numAccess: 1000,
      refreshPeriod: 100000
    };
    const hubRateLimit = {
      join: rateLimit,
      search: rateLimit,
      global: rateLimit
    };
    const db = new MemoryDB();
    await HubServer.setHubRegistryToDB(db, {
      hubRegistry: hubRegistry,
      merkleProof: merkleProof
    });
    hub = new HubServer(hubkeypair, adminAddress, hubRateLimit, db);
    await hub.start();

    const addr = hub.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  after(() => {
    hub.close();
  });

  it("request fails when message has unsupported RPC type", async () => {
    // Invalid registry because of the wrong pubkey
    const expectedUnsupportedType = 5566;
    const c = await connect(ip, port);
    const tlv = new TLV(new Short(expectedUnsupportedType), new Uint8Array());
    c.write(tlv.serialize());
    await expect(c.read()).to.be.rejected;
  });

  it("`Join` request should succeed with correct request data", async () => {
    const signedMsg = signedJoinMsgFactory(user1, hubkeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsg.userPubkey,
      signedMsg.userSig,
      host,
      signedMsg.hubPubkey
    );
    expect(await hub.userStore.getLength()).to.eql(1);
    expect(hub.userStore.get(signedMsg.userPubkey)).not.to.be.undefined;

    // Another request

    const signedMsgAnother = signedJoinMsgFactory(user2, hubkeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsgAnother.userPubkey,
      signedMsgAnother.userSig,
      host,
      signedMsgAnother.hubPubkey
    );
    expect(await hub.userStore.getLength()).to.eql(2);
    expect(hub.userStore.get(signedMsgAnother.userPubkey)).not.to.be.undefined;
  });

  it("search succeeds", async () => {
    const searchRes = await sendSearchReq(ip, port, user1.pubKey);
    expect(searchRes).not.to.be.null;
  });

  it("search fails when target is not found", async () => {
    const anotherUser = genKeypair();
    const searchRes = await sendSearchReq(ip, port, anotherUser.pubKey);
    expect(searchRes).to.be.null;
  });

  it("request fails when timeout", async () => {
    // NOTE: Server still possibly adds the registry in `userStore` because
    //  the request is indeed valid. We can let the server revert if timeout happens.
    //  However, it requires additional designs.
    // Invalid registry because of the wrong pubkey
    const signedMsg = signedJoinMsgFactory(undefined, hubkeypair);
    const timeoutExpectedToFail = 10;
    await expect(
      sendJoinHubReq(
        ip,
        port,
        signedMsg.userPubkey,
        signedMsg.userSig,
        host,
        signedMsg.hubPubkey,
        timeoutExpectedToFail
      )
    ).to.be.rejectedWith(TimeoutError);
  });

  it("requests fail when rate limit is reached", async () => {
    const hubkeypair = genKeypair();
    const adminAddress = adminAddressFactory();
    const tree = hubRegistryTreeFactory([hubkeypair], LEVELS, adminAddress);
    expect(tree.length).to.eql(1);
    const hubRegistry = tree.leaves[0];
    const merkleProof = tree.tree.genMerklePath(0);

    const createHub = async (rateLimit: THubRateLimit) => {
      const db = new MemoryDB();
      await HubServer.setHubRegistryToDB(db, {
        hubRegistry: hubRegistry,
        merkleProof: merkleProof
      });
      const hub = new HubServer(hubkeypair, adminAddress, rateLimit, db);
      await hub.start();
      const port = hub.address.port;
      return { hub, port };
    };

    const zeroRateLimit = { numAccess: 0, refreshPeriod: 100000 };
    const normalRateLimit = { numAccess: 1000, refreshPeriod: 100000 };

    // Put zero rate limit on join requests, thus only join requests fail.
    await (async () => {
      const { hub, port } = await createHub({
        join: zeroRateLimit,
        search: normalRateLimit,
        global: normalRateLimit
      });
      const signedMsg = signedJoinMsgFactory(user1, hubkeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          host,
          signedMsg.hubPubkey
        )
      ).to.be.rejected;
      // Search succeeds: temporarily comment it out since it's too slow.
      // await sendSearchReq(ip, port, user1.pubKey);
      hub.close();
    })();

    // Put zero rate limit on search requests, thus only search requests fail.
    await (async () => {
      const { hub, port } = await createHub({
        join: normalRateLimit,
        search: zeroRateLimit,
        global: normalRateLimit
      });
      await expect(sendSearchReq(ip, port, user1.pubKey)).to.be.rejected;
      hub.close();
    })();

    // Put zero rate limit on global, thus any request fails.
    await (async () => {
      const { hub, port } = await createHub({
        join: normalRateLimit,
        search: normalRateLimit,
        global: zeroRateLimit
      });
      const signedMsg = signedJoinMsgFactory(user1, hubkeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          host,
          signedMsg.hubPubkey
        )
      ).to.be.rejected;
      await expect(sendSearchReq(ip, port, user1.pubKey)).to.be.rejected;
      hub.close();
    })();
  });
});
