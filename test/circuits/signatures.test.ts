import { stringifyBigInts, Signature, PubKey, genKeypair } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import {
  verifySignedMsg,
  getJoinHubMsgHashedData,
  prefixRegisterNewHub,
  getCounterSignHashedData,
  signMsg
} from "../../src";
import { bigIntFactoryExclude } from "../utils";

jest.setTimeout(90000);

describe("babyJub signatures", () => {
  let circuit;

  beforeAll(async () => {
    circuit = await compileCircuit("verifySignature.circom");
  });

  const verifySigInCircuit = async (
    data: BigInt,
    sig: Signature,
    pubkey: PubKey
  ) => {
    const circuitInputs = stringifyBigInts({
      Ax: stringifyBigInts(pubkey[0]),
      Ay: stringifyBigInts(pubkey[1]),
      R8x: stringifyBigInts(sig.R8[0]),
      R8y: stringifyBigInts(sig.R8[1]),
      S: stringifyBigInts(sig.S),
      M: stringifyBigInts(data)
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
    expect(verifySignedMsg(joinMsg, sigA, userA.pubKey)).toBeTruthy();

    // In circuits

    /* join-hub msg */
    // Succeeds
    expect(await verifySigInCircuit(joinMsg, sigA, userA.pubKey)).toBeTruthy();

    // Fails

    // Use `bigIntFactoryExclude` over `privkeyFactoryExclude` because the result of
    // `bigIntFactoryExclude` is guaranteed <= 253 bits.
    const anotherElement = bigIntFactoryExclude([
      joinMsg,
      ...sigA.R8,
      sigA.S,
      ...userA.pubKey
    ]);
    // Wrong msg
    expect(
      await verifySigInCircuit(
        joinMsg,
        { R8: [sigA.R8[0], anotherElement], S: sigA.S },
        userA.pubKey
      )
    ).toBeFalsy();
    // Wrong `sig.R8`
    expect(
      await verifySigInCircuit(
        joinMsg,
        { R8: [anotherElement, sigA.R8[1]], S: sigA.S },
        userA.pubKey
      )
    ).toBeFalsy();
    expect(
      await verifySigInCircuit(
        joinMsg,
        { R8: sigA.R8, S: anotherElement },
        userA.pubKey
      )
    ).toBeFalsy();
    // Wrong `sig.S`
    expect(
      await verifySigInCircuit(
        joinMsg,
        { R8: [sigA.R8[0], anotherElement], S: sigA.S },
        userA.pubKey
      )
    ).toBeFalsy();
    // Wrong `pubkey`
    expect(
      await verifySigInCircuit(joinMsg, sigA, [anotherElement, anotherElement])
    ).toBeFalsy();

    /* Counter signed join-hub msg */
    const counterSignedhashedData = getCounterSignHashedData(sigA);
    const sigCounterSigned = signMsg(hub.privKey, counterSignedhashedData);
    expect(
      await verifySigInCircuit(
        counterSignedhashedData,
        sigCounterSigned,
        hub.pubKey
      )
    ).toBeTruthy();

    /* new-hub msg */

    const admin = genKeypair();
    const sigHub = signMsg(hub.privKey, prefixRegisterNewHub);
    // Succeeds
    expect(
      await verifySigInCircuit(prefixRegisterNewHub, sigHub, hub.pubKey)
    ).toBeTruthy();

    // Fails

    // Wrong msg
    expect(
      await verifySigInCircuit(anotherElement, sigHub, hub.pubKey)
    ).toBeFalsy();
    // Wrong `sig.R8`
    expect(
      await verifySigInCircuit(
        prefixRegisterNewHub,
        { R8: [sigHub.R8[0], anotherElement], S: sigHub.S },
        hub.pubKey
      )
    ).toBeFalsy();
    expect(
      await verifySigInCircuit(
        prefixRegisterNewHub,
        { R8: [anotherElement, sigHub.R8[1]], S: sigHub.S },
        hub.pubKey
      )
    ).toBeFalsy();
    // Wrong `sig.S`
    expect(
      await verifySigInCircuit(
        prefixRegisterNewHub,
        { R8: sigHub.R8, S: anotherElement },
        hub.pubKey
      )
    ).toBeFalsy();
    // Wrong `pubkey`
    expect(
      await verifySigInCircuit(prefixRegisterNewHub, sigHub, [
        anotherElement,
        anotherElement
      ])
    ).toBeFalsy();

    /* Counter signed new-hub msg */
    const counterSignedNewHubMsg = getCounterSignHashedData(sigHub);
    const sigCounterSignedNewHubMsg = signMsg(
      admin.privKey,
      counterSignedNewHubMsg
    );
    expect(
      await verifySigInCircuit(
        counterSignedNewHubMsg,
        sigCounterSignedNewHubMsg,
        admin.pubKey
      )
    ).toBeTruthy();
  });
});
