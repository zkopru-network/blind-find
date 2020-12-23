import { hubRegistryTreeFactory, signedJoinMsgFactory } from "../src/factories";
import {
  HubServer,
  sendJoinHubReq,
  sendSearchReq,
  UserStore
} from "../src/hub";
import { genKeypair, Keypair, Signature } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistryTree } from "../src";
import WebSocket from "ws";
import { TimeoutError } from "../src/exceptions";
import { waitForSocketOpen, connect } from "../src/websocket";
import { Short, TLV } from "../src/smp/serialization";

const timeoutSmall = 5000;

jest.setTimeout(30000);

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
  let hubkeypair: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let admin: Keypair;
  let tree: HubRegistryTree;
  // let hubRegistry: HubRegistry;
  let ip: string;
  let port: number;

  beforeAll(async () => {
    hubkeypair = genKeypair();
    admin = genKeypair();
    user1 = genKeypair();
    user2 = genKeypair();
    tree = hubRegistryTreeFactory([hubkeypair], LEVELS, admin);
    expect(tree.length).toEqual(1);
    // hubRegistry = tree.leaves[0];
    hub = new HubServer(hubkeypair);
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
    const c = connect(ip, port);

    // Wait until the socket is opened.
    await waitForSocketOpen(c);
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
      signedMsg.hubPubkey,
      timeoutSmall
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
      signedMsgAnother.hubPubkey,
      timeoutSmall
    );
    expect(hub.userStore.size).toEqual(2);
    expect(hub.userStore.get(signedMsgAnother.userPubkey)).not.toBeUndefined();
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

  test("single SMP", async () => {
    expect(await sendSearchReq(ip, port, user1.pubKey)).toBeTruthy();
  });
});
