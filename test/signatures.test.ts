import { genKeypair } from "maci-crypto";
import {
  signMsg,
  getCounterSignHashedData,
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getRegisterNewHubHashedData
} from "../src";
import { adminAddressFactory } from "../src/factories";
import { bigIntFactoryExclude, privkeyFactoryExclude } from "./utils";

describe("Join hub msg", () => {
  const hub = genKeypair();
  const userA = genKeypair();
  const joinMsg = getJoinHubMsgHashedData(userA.pubKey, hub.pubKey);
  const sigA = signMsg(userA.privKey, joinMsg);

  test("`verifySignedMsg` should succeed with correct inputs", () => {
    expect(verifySignedMsg(joinMsg, sigA, userA.pubKey)).toBeTruthy();
  });

  test("`verifySignedMsg` should fail when wrong signature/pubkey/msg is used", () => {
    const anotherElement = privkeyFactoryExclude([
      joinMsg,
      ...sigA.R8,
      sigA.S,
      ...userA.pubKey
    ]);
    // Wrong msg
    expect(verifySignedMsg(anotherElement, sigA, userA.pubKey)).toBeFalsy();
    // Wrong `sig.R8`
    expect(
      verifySignedMsg(
        joinMsg,
        { R8: [sigA.R8[0], anotherElement], S: sigA.S },
        userA.pubKey
      )
    ).toBeFalsy();
    expect(
      verifySignedMsg(
        joinMsg,
        { R8: [anotherElement, sigA.R8[1]], S: sigA.S },
        userA.pubKey
      )
    ).toBeFalsy();
    // Wrong `sig.S`
    expect(
      verifySignedMsg(joinMsg, { R8: sigA.R8, S: anotherElement }, userA.pubKey)
    ).toBeFalsy();
    // Wrong `pubkey`
    expect(
      verifySignedMsg(joinMsg, sigA, [anotherElement, anotherElement])
    ).toBeFalsy();
  });

  test("`verifySignedMsg` should work with the counter signed signature", () => {
    const counterSignedhashedData = getCounterSignHashedData(sigA);
    const sigCounterSigned = signMsg(hub.privKey, counterSignedhashedData);
    expect(
      verifySignedMsg(counterSignedhashedData, sigCounterSigned, hub.pubKey)
    ).toBeTruthy();
  });
});

describe("New hub msg", () => {
  const hub = genKeypair();
  const adminAddress = adminAddressFactory();
  const hashedData = getRegisterNewHubHashedData(adminAddress);
  const sigHub = signMsg(hub.privKey, hashedData);

  test("`verifySignedMsg` should succeed with correct inputs", () => {
    expect(verifySignedMsg(hashedData, sigHub, hub.pubKey)).toBeTruthy();
  });

  test("`verifySignedMsg` should fail when wrong signature/pubkey/msg is used", () => {
    const anotherElement = bigIntFactoryExclude([
      hashedData,
      ...sigHub.R8,
      sigHub.S,
      ...hub.pubKey
    ]);
    // Wrong msg
    expect(verifySignedMsg(anotherElement, sigHub, hub.pubKey)).toBeFalsy();
    // Wrong `sig.R8`
    expect(
      verifySignedMsg(
        hashedData,
        { R8: [sigHub.R8[0], anotherElement], S: sigHub.S },
        hub.pubKey
      )
    ).toBeFalsy();
    expect(
      verifySignedMsg(
        hashedData,
        { R8: [anotherElement, sigHub.R8[1]], S: sigHub.S },
        hub.pubKey
      )
    ).toBeFalsy();
    // Wrong `sig.S`
    expect(
      verifySignedMsg(
        hashedData,
        { R8: sigHub.R8, S: anotherElement },
        hub.pubKey
      )
    ).toBeFalsy();
    // Wrong `pubkey`
    expect(
      verifySignedMsg(hashedData, sigHub, [anotherElement, anotherElement])
    ).toBeFalsy();
  });
});
