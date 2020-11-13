import { stringifyBigInts, Signature, PubKey, genKeypair } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import {
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getCounterSignHashedData,
  signMsg,
  prefixRegisterNewHub
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

describe("new hub signatures", () => {
  let circuit;

  beforeAll(async () => {
    circuit = await compileCircuit("testHubRegistryVerifier.circom");
  });

  const verifySigInCircuit = async (
    pubkeyHub: PubKey,
    sigHub: Signature,
    pubkeyAdmin: PubKey,
    sigAdmin: Signature
  ) => {
    /**
            signal input pubkeyHub[2];
            signal input sigHubR8[2];
            signal input sigHubS;
            // Assume every one knows the pubkey of admin
            signal input pubkeyAdmin[2];
            signal input sigAdminR8[2];
            signal input sigAdminS;
         */
    const circuitInputs = stringifyBigInts({
      pubkeyHub: [pubkeyHub[0].toString(), pubkeyHub[1].toString()],
      sigHubR8: [sigHub.R8[0].toString(), sigHub.R8[1].toString()],
      sigHubS: sigHub.S.toString(),
      pubkeyAdmin: [pubkeyAdmin[0].toString(), pubkeyAdmin[1].toString()],
      sigAdminR8: [sigAdmin.R8[0].toString(), sigAdmin.R8[1].toString()],
      sigAdminS: sigAdmin.S.toString()
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const isValid = getSignalByName(circuit, witness, "main.valid").toString();
    return isValid === "1";
  };

  test("verifySignedMsg", async () => {
    const admin = genKeypair();
    const hub = genKeypair();
    const sigHub = signMsg(hub.privKey, prefixRegisterNewHub);
    /* Counter signed join-hub msg */
    const counterSignedhashedData = getCounterSignHashedData(sigHub);
    const sigAdmin = signMsg(admin.privKey, counterSignedhashedData);
    expect(
      verifySignedMsg(prefixRegisterNewHub, sigHub, hub.pubKey)
    ).toBeTruthy();

    /* join-hub msg */
    // Succeeds
    expect(
      await verifySigInCircuit(hub.pubKey, sigHub, admin.pubKey, sigAdmin)
    ).toBeTruthy();
  });
});
