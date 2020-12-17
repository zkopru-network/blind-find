import { hubRegistryTreeFactory, signedJoinMsgFactory } from "../src/factories";
import { Hub, sendJoinHubReq } from "../src/hub";
import { genKeypair, Keypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { HubRegistryTree } from "../src";
import WebSocket from "ws";

const timeoutSmall = 100;

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
