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
    /**
     * signal input userPubkey[2];
     * signal input userSigR8[2];
     * signal input userSigS;
     * signal input hubPubkey[2];
     * signal input hubSigR8[2];
     * signal input hubSigS;
     */
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
