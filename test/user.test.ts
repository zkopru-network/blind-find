import { genKeypair } from "maci-crypto";
import WebSocket from "ws";
import { verifyProofIndirectConnection } from "../src/circuits/ts";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import {
  hubRegistryTreeFactory,
} from "../src/factories";
import { HubServer } from "../src/hub";
import { User } from "../src/user";

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 2;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;

jest.setTimeout(timeoutTotal);

describe("User", () => {
  const admin = genKeypair();
  const hubKeypair = genKeypair();
  const tree = hubRegistryTreeFactory([hubKeypair], LEVELS, admin);
  expect(tree.length).toEqual(1);
  const hubRegistry = tree.leaves[0];
  const merkleProof = tree.tree.genMerklePath(0);
  const hub = new HubServer(hubKeypair, hubRegistry, merkleProof);
  let ip: string;
  let port: number;

  const userJoined = new User(genKeypair(), admin.pubKey, merkleProof.root);
  const userAnother = new User(genKeypair(), admin.pubKey, merkleProof.root);

  beforeAll(async () => {
    await hub.start();

    const addr = hub.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
    await userJoined.join(ip, port, hubKeypair.pubKey);
  });

  afterAll(() => {
    hub.close();
  });

  test("search", async () => {
    // Search succeeds
    const proof = await userAnother.search(ip, port, userJoined.keypair.pubKey);
    expect(proof).not.toBeNull();
    if (proof === null) {
      // Makes compiler happy
      throw new Error();
    }
    expect(await verifyProofIndirectConnection(proof)).toBeTruthy();
    // Search fails
    const keypairNotFound = genKeypair();
    expect(
      await userAnother.search(ip, port, keypairNotFound.pubKey)
    ).toBeFalsy();
  });
});
