import { hubRegistryTreeFactory, signedJoinMsgFactory } from "../src/factories";
import { Hub, sendJoinHubReq, UserStore } from "../src/hub";
import { genKeypair, Keypair, Signature } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistryTree } from "../src";
import WebSocket from "ws";

const timeoutSmall = 100;

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

  test("for each should work", () => {
    let counter = 0;
    userStore.forEach(() => {
      counter += 1;
    });
    expect(counter).toEqual(2);
  });

  test("get fails when no matched entry", () => {
    const anotherUser = genKeypair();
    expect(userStore.get(anotherUser.pubKey)).toBeUndefined();
  });
});

describe("DataProviderServer", () => {
  let hub: Hub;
  let hubkeypair: Keypair;
  let admin: Keypair;
  let tree: HubRegistryTree;
  // let hubRegistry: HubRegistry;
  let ip: string;
  let port: number;

  beforeAll(async () => {
    hubkeypair = genKeypair();
    admin = genKeypair();
    tree = hubRegistryTreeFactory([hubkeypair], LEVELS, admin);
    expect(tree.length).toEqual(1);
    // hubRegistry = tree.leaves[0];
    hub = new Hub(hubkeypair);
    await hub.start();

    const addr = hub.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  afterAll(() => {
    hub.close();
  });

  test("send request", async () => {
    const signedMsg = signedJoinMsgFactory(undefined, hubkeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsg.userPubkey,
      signedMsg.userSig,
      signedMsg.hubPubkey,
      timeoutSmall
    );
    expect(hub.userStore.size).toEqual(1);
    const userData = hub.userStore.get(signedMsg.userPubkey);
    if (userData === undefined) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(userData, signedMsg);
  });

  // test("request fails when registry is invalid", async () => {
  //   // Invalid registry because of the wrong pubkey
  //   const invalidRegistry = hubRegistryFactory();
  //   invalidRegistry.pubkey = admin.pubKey;
  //   await expect(
  //     sendGetMerkleProofReq(ip, port, invalidRegistry)
  //   ).rejects.toThrowError(ValueError);
  // });

  // test("request fails when no registry matches", async () => {
  //   const randomValidRegistry = hubRegistryFactory();
  //   await expect(
  //     sendGetMerkleProofReq(ip, port, randomValidRegistry)
  //   ).rejects.toThrowError(RequestFailed);
  // });
});
