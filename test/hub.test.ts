import {
  adminAddressFactory,
  hubRegistryTreeFactory,
  signedJoinMsgFactory
} from "../src/factories";
import {
  HubServer,
  sendJoinHubReq,
  sendSearchReq,
  UserStore
} from "../src/hub";
import { genKeypair, Signature } from "maci-crypto";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import WebSocket from "ws";
import { TimeoutError } from "../src/exceptions";
import { connect, TRateLimitParams } from "../src/websocket";
import { Short, TLV } from "../src/smp/serialization";

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 4;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;

jest.setTimeout(timeoutTotal);

type TRegistry = { userSig: Signature; hubSig: Signature };
const isRegistrySignedMsgMatch = (
  registry: TRegistry,
  signedMsg: TRegistry
) => {
  expect(registry.userSig).toEqual(signedMsg.userSig);
  expect(registry.hubSig).toEqual(signedMsg.hubSig);
};

describe("UserStore", () => {
  const userStore = new UserStore();
  const msgs = [signedJoinMsgFactory(), signedJoinMsgFactory()];

  test("set, get, and size succeed when adding reigstry", () => {
    userStore.set(msgs[0].userPubkey, {
      userSig: msgs[0].userSig,
      hubSig: msgs[0].hubSig
    });
    expect(userStore.size).toEqual(1);
    const registry = userStore.get(msgs[0].userPubkey);
    if (!registry) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registry, msgs[0]);
    userStore.set(msgs[1].userPubkey, {
      userSig: msgs[1].userSig,
      hubSig: msgs[1].hubSig
    });
    expect(userStore.size).toEqual(2);
    const registryAnother = userStore.get(msgs[1].userPubkey);
    if (!registryAnother) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registryAnother, msgs[1]);
  });

  test("userStore is an Iterable", () => {
    const a: any[] = [];
    for (const item of userStore) {
      a.push(item);
    }
    expect(a.length).toEqual(userStore.size);
  });

  test("get fails when no matched entry", () => {
    const anotherUser = genKeypair();
    expect(userStore.get(anotherUser.pubKey)).toBeUndefined();
  });
});

describe("HubServer", () => {
  // NOTE: We only have **one** hub server in our tests. This means the order of the
  //  following tests matters. The server should be alive until the end of the final
  //  test (which should be closed in `afterAll`).
  let hub: HubServer;
  let ip: string;
  let port: number;
  const hubkeypair = genKeypair();
  const adminAddress = adminAddressFactory();
  const user1 = genKeypair();
  const user2 = genKeypair();
  const tree = hubRegistryTreeFactory([hubkeypair], LEVELS, adminAddress);
  expect(tree.length).toEqual(1);
  const hubRegistry = tree.leaves[0];
  const merkleProof = tree.tree.genMerklePath(0);

  beforeAll(async () => {
    const rateLimit = {
      numAccess: 1000,
      refreshPeriod: 100000
    };
    hub = new HubServer(
      hubkeypair,
      hubRegistry,
      merkleProof,
      rateLimit,
      rateLimit,
      rateLimit
    );
    await hub.start();

    const addr = hub.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  afterAll(() => {
    hub.close();
  });

  test("request fails when message has unsupported RPC type", async () => {
    // Invalid registry because of the wrong pubkey
    const expectedUnsupportedType = 5566;
    const c = await connect(ip, port);

    const task = new Promise((res, rej) => {
      const tlv = new TLV(new Short(expectedUnsupportedType), new Uint8Array());
      c.onmessage = () => {
        res();
      };
      c.onclose = event => {
        rej(new Error(event.reason));
      };
      c.onerror = event => {
        rej(event.error);
      };
      c.send(tlv.serialize());
    });
    await expect(task).rejects.toThrow();
  });

  test("`Join` request should succeed with correct request data", async () => {
    const signedMsg = signedJoinMsgFactory(user1, hubkeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsg.userPubkey,
      signedMsg.userSig,
      signedMsg.hubPubkey
    );
    expect(hub.userStore.size).toEqual(1);
    expect(hub.userStore.get(signedMsg.userPubkey)).not.toBeUndefined();

    // Another request

    const signedMsgAnother = signedJoinMsgFactory(user2, hubkeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsgAnother.userPubkey,
      signedMsgAnother.userSig,
      signedMsgAnother.hubPubkey
    );
    expect(hub.userStore.size).toEqual(2);
    expect(hub.userStore.get(signedMsgAnother.userPubkey)).not.toBeUndefined();
  });

  test("search succeeds", async () => {
    const searchRes = await sendSearchReq(ip, port, user1.pubKey);
    expect(searchRes).not.toBeNull();
  });

  test("search fails when target is not found", async () => {
    const anotherUser = genKeypair();
    const searchRes = await sendSearchReq(ip, port, anotherUser.pubKey);
    expect(searchRes).toBeNull();
  });

  test("request fails when timeout", async () => {
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
        signedMsg.hubPubkey,
        timeoutExpectedToFail
      )
    ).rejects.toThrowError(TimeoutError);
  });

  test.only("requests fail when rate limit is reached", async () => {
    const hubkeypair = genKeypair();
    const adminAddress = adminAddressFactory();
    const tree = hubRegistryTreeFactory([hubkeypair], LEVELS, adminAddress);
    expect(tree.length).toEqual(1);
    const hubRegistry = tree.leaves[0];
    const merkleProof = tree.tree.genMerklePath(0);

    const createHub = async (
      globalRateLimit: TRateLimitParams,
      joinRateLimit: TRateLimitParams,
      searchRateLimit: TRateLimitParams
    ) => {
      const hub = new HubServer(
        hubkeypair,
        hubRegistry,
        merkleProof,
        globalRateLimit,
        joinRateLimit,
        searchRateLimit
      );
      await hub.start();
      const port = hub.address.port;
      return { hub, port };
    };

    const zeroRateLimit = { numAccess: 0, refreshPeriod: 100000 };
    const normalRateLimit = { numAccess: 1000, refreshPeriod: 100000 };

    // Put zero rate limit on global, thus any request fails.
    await (async () => {
      const { hub, port } = await createHub(
        zeroRateLimit,
        normalRateLimit,
        normalRateLimit
      );
      const signedMsg = signedJoinMsgFactory(user1, hubkeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          signedMsg.hubPubkey
        )
      ).rejects.toBeTruthy();
      await expect(sendSearchReq(ip, port, user1.pubKey)).rejects.toBeTruthy();
      hub.close();
    })();

    // Put zero rate limit on join request, thus only join requests fail.
    await (async () => {
      const { hub, port } = await createHub(
        normalRateLimit,
        zeroRateLimit,
        normalRateLimit
      );
      const signedMsg = signedJoinMsgFactory(user1, hubkeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          signedMsg.hubPubkey
        )
      ).rejects.toBeTruthy();
      // await expect(sendSearchReq(ip, port, user1.pubKey)).rejects.toBeTruthy();
      hub.close();
    })();

    // Put zero rate limit on search request, thus only join requests fail.
    await (async () => {
      const { hub, port } = await createHub(
        normalRateLimit,
        normalRateLimit,
        zeroRateLimit
      );
      await expect(sendSearchReq(ip, port, user1.pubKey)).rejects.toBeTruthy();
      hub.close();
    })();
  });
});
