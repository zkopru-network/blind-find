import { genKeypair } from "maci-crypto";
import { signMsg, getCounterSignHashedData, verifySignedMsg, getJoinHubMsgHashedData } from "../src";

describe('Signatures', () => {
    test('', () => {
        const hub = genKeypair();
        const userA = genKeypair();
        const joinMsg = getJoinHubMsgHashedData(userA.pubKey, hub.pubKey);
        const sigA = signMsg(userA.privKey, joinMsg);
        expect(verifySignedMsg(joinMsg, sigA, userA.pubKey)).toBeTruthy();
        const counterSignedhashedData = getCounterSignHashedData(sigA);
        const sigCounterSigned = signMsg(hub.privKey, counterSignedhashedData);
        expect(verifySignedMsg(counterSignedhashedData, sigCounterSigned, hub.pubKey)).toBeTruthy();
    });
});
