import { genKeypair } from "maci-crypto";
import {
  signMsg,
  prefixRegisterNewHub,
  getCounterSignHashedData,
  verifySignedMsg,
  getJoinHubMsgHashedData
} from "../src";
import { privkeyFactoryExclude } from "./utils";

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
  const admin = genKeypair();
  const sigHub = signMsg(hub.privKey, prefixRegisterNewHub);

  test("`verifySignedMsg` should succeed with correct inputs", () => {
    expect(
      verifySignedMsg(prefixRegisterNewHub, sigHub, hub.pubKey)
    ).toBeTruthy();
  });

  test("`verifySignedMsg` should fail when wrong signature/pubkey/msg is used", () => {
    const anotherElement = privkeyFactoryExclude([
      prefixRegisterNewHub,
      ...sigHub.R8,
      sigHub.S,
      ...hub.pubKey
    ]);
    // Wrong msg
    expect(verifySignedMsg(anotherElement, sigHub, hub.pubKey)).toBeFalsy();
    // Wrong `sig.R8`
    expect(
      verifySignedMsg(
        prefixRegisterNewHub,
        { R8: [sigHub.R8[0], anotherElement], S: sigHub.S },
        hub.pubKey
      )
    ).toBeFalsy();
    expect(
      verifySignedMsg(
        prefixRegisterNewHub,
        { R8: [anotherElement, sigHub.R8[1]], S: sigHub.S },
        hub.pubKey
      )
    ).toBeFalsy();
    // Wrong `sig.S`
    expect(
      verifySignedMsg(
        prefixRegisterNewHub,
        { R8: sigHub.R8, S: anotherElement },
        hub.pubKey
      )
    ).toBeFalsy();
    // Wrong `pubkey`
    expect(
      verifySignedMsg(prefixRegisterNewHub, sigHub, [
        anotherElement,
        anotherElement
      ])
    ).toBeFalsy();
  });

  test("`verifySignedMsg` should work with the counter signed signature", () => {
    const counterSignedhashedData = getCounterSignHashedData(sigHub);
    const sigCounterSigned = signMsg(admin.privKey, counterSignedhashedData);
    expect(
      verifySignedMsg(counterSignedhashedData, sigCounterSigned, admin.pubKey)
    ).toBeTruthy();
  });
});
