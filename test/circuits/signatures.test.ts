import { stringifyBigInts, Signature, PubKey, genKeypair } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import {
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getCounterSignHashedData,
  signMsg
} from "../../src";
import { bigIntFactoryExclude } from "../utils";
import { hubRegistryTreeFactory } from "../../src/factories";

jest.setTimeout(90000);

describe("join msg signatures", () => {
  let circuit;

  beforeAll(async () => {
    circuit = await compileCircuit("testJoinMsgSigVerifier.circom");
  });

  const verifySigInCircuit = async (
    userPubkey: PubKey,
    userSig: Signature,
    hubPubkey: PubKey,
    sigHub: Signature
  ) => {
    const circuitInputs = stringifyBigInts({
      userPubkey: [userPubkey[0].toString(), userPubkey[1].toString()],
      userSigR8: [userSig.R8[0].toString(), userSig.R8[1].toString()],
      userSigS: userSig.S.toString(),
      hubPubkey: [hubPubkey[0].toString(), hubPubkey[1].toString()],
      hubSigR8: [sigHub.R8[0].toString(), sigHub.R8[1].toString()],
      hubSigS: sigHub.S.toString()
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const isValid = getSignalByName(circuit, witness, "main.valid").toString();
    return isValid === "1";
  };

  test("verifySignedMsg", async () => {
    const hub = genKeypair();
    const userA = genKeypair();
    const joinMsg = getJoinHubMsgHashedData(userA.pubKey, hub.pubKey);
    const sigA = signMsg(userA.privKey, joinMsg);
    /* Counter signed join-hub msg */
    const counterSignedhashedData = getCounterSignHashedData(sigA);
    const sigHub = signMsg(hub.privKey, counterSignedhashedData);
    expect(verifySignedMsg(joinMsg, sigA, userA.pubKey)).toBeTruthy();

    // In circuits

    /* join-hub msg */
    // Succeeds
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, sigHub)
    ).toBeTruthy();

    // Fails

    // Use `bigIntFactoryExclude` over `privkeyFactoryExclude` because the result of
    // `bigIntFactoryExclude` is guaranteed <= 253 bits.
    const anotherElement = bigIntFactoryExclude([
      joinMsg,
      ...sigA.R8,
      sigA.S,
      ...userA.pubKey
    ]);
    // Wrong `sigA.R8`
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [anotherElement, sigA.R8[1]], S: sigA.S },
        hub.pubKey,
        sigHub
      )
    ).toBeFalsy();
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [sigA.R8[0], anotherElement], S: sigA.S },
        hub.pubKey,
        sigHub
      )
    ).toBeFalsy();
    // Wrong `sigA.S`
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [sigA.R8[0], sigA.R8[0]], S: anotherElement },
        hub.pubKey,
        sigHub
      )
    ).toBeFalsy();
    // Wrong `userPubkey`
    expect(
      await verifySigInCircuit(
        [anotherElement, anotherElement],
        { R8: [sigA.R8[0], sigA.R8[0]], S: sigA.S },
        hub.pubKey,
        sigHub
      )
    ).toBeFalsy();
    // Wrong `hubPubkey`
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [sigA.R8[0], sigA.R8[0]], S: sigA.S },
        [anotherElement, anotherElement],
        sigHub
      )
    ).toBeFalsy();
    // Wrong `sigHub.R8`
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, {
        R8: [anotherElement, sigHub.R8[1]],
        S: sigHub.S
      })
    ).toBeFalsy();
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, {
        R8: [sigHub.R8[0], anotherElement],
        S: sigHub.S
      })
    ).toBeFalsy();
    // Wrong `sigHub.S`
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, {
        R8: [sigHub.R8[0], sigHub.R8[0]],
        S: anotherElement
      })
    ).toBeFalsy();
  });
});

describe("HubRegistry", () => {
  let circuit;

  beforeAll(async () => {
    circuit = await compileCircuit("testHubRegistryVerifier.circom");
  });

  test("verifySignedMsg", async () => {
    const admin = genKeypair();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const treeLevels = 4;
    const tree = hubRegistryTreeFactory(hubs, treeLevels, admin);

    const verify = async (leafIndex: number) => {
      const root = tree.tree.root;
      const proof = tree.tree.genMerklePath(leafIndex);
      const registry = tree.leaves[leafIndex];
      if (!registry.verify()) {
        throw new Error(`registry is invalid: leafIndex=${leafIndex}`);
      }
      if (
        registry.adminPubkey === undefined ||
        registry.adminSig === undefined
      ) {
        throw new Error(`registry is not counter-signed: registry=${registry}`);
      }
      const circuitInputs = {
        pubkeyHub: [
          registry.pubkey[0].toString(),
          registry.pubkey[1].toString()
        ],
        sigHubR8: [
          registry.sig.R8[0].toString(),
          registry.sig.R8[1].toString()
        ],
        sigHubS: registry.sig.S.toString(),
        merklePathElements: proof.pathElements,
        merklePathIndices: proof.indices,
        merkleRoot: root,
        pubkeyAdmin: [
          registry.adminPubkey[0].toString(),
          registry.adminPubkey[1].toString()
        ],
        sigAdminR8: [
          registry.adminSig.R8[0].toString(),
          registry.adminSig.R8[1].toString()
        ],
        sigAdminS: registry.adminSig.S.toString()
      };
      const witness = await executeCircuit(circuit, circuitInputs);
      const isValid = getSignalByName(
        circuit,
        witness,
        "main.valid"
      ).toString();
      return isValid === "1";
    };

    // Succeeds
    expect(await verify(1)).toBeTruthy();
  });
});
