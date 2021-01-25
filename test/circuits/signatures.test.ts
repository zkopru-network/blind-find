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
import {
  adminAddressFactory,
  hubRegistryTreeFactory
} from "../../src/factories";
import { expect } from "chai";

describe("join msg signatures", function() {
  this.timeout(90000);

  let circuit;

  before(async () => {
    circuit = await compileCircuit("testJoinMsgSigVerifier.circom");
  });

  const verifySigInCircuit = async (
    userPubkey: PubKey,
    userSig: Signature,
    hubPubkey: PubKey,
    sigHub: Signature
  ) => {
    const circuitInputs = stringifyBigInts({
      userPubkey: userPubkey,
      userSigR8: userSig.R8,
      userSigS: userSig.S,
      hubPubkey: hubPubkey,
      hubSigR8: sigHub.R8,
      hubSigS: sigHub.S
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const isValid = getSignalByName(circuit, witness, "main.valid").toString();
    return isValid === "1";
  };

  it("verifySignedMsg", async () => {
    const hub = genKeypair();
    const userA = genKeypair();
    const joinMsg = getJoinHubMsgHashedData(userA.pubKey, hub.pubKey);
    const sigA = signMsg(userA.privKey, joinMsg);
    /* Counter signed join-hub msg */
    const counterSignedhashedData = getCounterSignHashedData(sigA);
    const sigHub = signMsg(hub.privKey, counterSignedhashedData);
    expect(verifySignedMsg(joinMsg, sigA, userA.pubKey)).to.be.true;

    // In circuits

    /* join-hub msg */
    // Succeeds
    expect(await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, sigHub)).to
      .be.true;

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
    ).to.be.false;
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [sigA.R8[0], anotherElement], S: sigA.S },
        hub.pubKey,
        sigHub
      )
    ).to.be.false;
    // Wrong `sigA.S`
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [sigA.R8[0], sigA.R8[0]], S: anotherElement },
        hub.pubKey,
        sigHub
      )
    ).to.be.false;
    // Wrong `userPubkey`
    expect(
      await verifySigInCircuit(
        [anotherElement, anotherElement],
        { R8: [sigA.R8[0], sigA.R8[0]], S: sigA.S },
        hub.pubKey,
        sigHub
      )
    ).to.be.false;
    // Wrong `hubPubkey`
    expect(
      await verifySigInCircuit(
        userA.pubKey,
        { R8: [sigA.R8[0], sigA.R8[0]], S: sigA.S },
        [anotherElement, anotherElement],
        sigHub
      )
    ).to.be.false;
    // Wrong `sigHub.R8`
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, {
        R8: [anotherElement, sigHub.R8[1]],
        S: sigHub.S
      })
    ).to.be.false;
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, {
        R8: [sigHub.R8[0], anotherElement],
        S: sigHub.S
      })
    ).to.be.false;
    // Wrong `sigHub.S`
    expect(
      await verifySigInCircuit(userA.pubKey, sigA, hub.pubKey, {
        R8: [sigHub.R8[0], sigHub.R8[0]],
        S: anotherElement
      })
    ).to.be.false;
  });
});

describe("HubRegistry", function() {
  let circuit;

  before(async () => {
    circuit = await compileCircuit("testHubRegistryVerifier.circom");
  });

  it("verifySignedMsg", async () => {
    const adminAddress = adminAddressFactory();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const treeLevels = 4;
    const tree = hubRegistryTreeFactory(hubs, treeLevels, adminAddress);

    const verify = async (leafIndex: number) => {
      const root = tree.tree.root;
      const proof = tree.tree.genMerklePath(leafIndex);
      const registry = tree.leaves[leafIndex];
      if (!registry.verify()) {
        throw new Error(`registry is invalid: leafIndex=${leafIndex}`);
      }
      const circuitInputs = {
        pubkeyHub: registry.pubkey,
        sigHubR8: registry.sig.R8,
        sigHubS: registry.sig.S,
        merklePathElements: proof.pathElements,
        merklePathIndices: proof.indices,
        merkleRoot: root,
        adminAddress: registry.adminAddress
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
    expect(await verify(1)).to.be.true;
  });
});
