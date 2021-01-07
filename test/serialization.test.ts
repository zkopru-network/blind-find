import { genKeypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import {
  hubRegistryFactory,
  hubRegistryTreeFactory,
  signedJoinMsgFactory
} from "../src/factories";
import {
  GetMerkleProofReq,
  GetMerkleProofResp,
  JoinReq,
  JoinResp,
  SearchMessage1,
  SearchMessage3
} from "../src/serialization";
import { smpMessage1Factory } from "../src/smp/v4/factories";
import { SMPMessage1Wire } from "../src/smp/v4/serialization";

describe("Serialization and Deserialization of wire messages", () => {
  test("GetMerkleProofReq", () => {
    const hubRegistry = hubRegistryFactory();
    const req = new GetMerkleProofReq(hubRegistry.pubkey, hubRegistry.sig);
    const bytes = req.serialize();
    const reqFromBytes = GetMerkleProofReq.deserialize(bytes);
    expect(req.hubPubkey).toEqual(reqFromBytes.hubPubkey);
    expect(req.hubSig).toEqual(reqFromBytes.hubSig);

    const [reqFromBytesConsumed, bytesRemaining] = GetMerkleProofReq.consume(
      bytes
    );
    expect(bytesRemaining.length).toEqual(0);
    expect(req.hubPubkey).toEqual(reqFromBytesConsumed.hubPubkey);
    expect(req.hubSig).toEqual(reqFromBytesConsumed.hubSig);
  });

  test("GetMerkleProofResp", () => {
    const hub = genKeypair();
    const tree = hubRegistryTreeFactory([hub], LEVELS);
    const merkleProof = tree.tree.genMerklePath(0);
    const msg = new GetMerkleProofResp(merkleProof);
    const bytes = msg.serialize();
    const msgFromBytes = GetMerkleProofResp.deserialize(bytes);
    expect(msg.merkleProof.pathElements).toEqual(
      msgFromBytes.merkleProof.pathElements
    );
    expect(msg.merkleProof.indices).toEqual(msgFromBytes.merkleProof.indices);
    expect(msg.merkleProof.depth).toEqual(msgFromBytes.merkleProof.depth);
    expect(msg.merkleProof.root).toEqual(msgFromBytes.merkleProof.root);
    expect(msg.merkleProof.leaf).toEqual(msgFromBytes.merkleProof.leaf);
  });

  test("JoinReq", () => {
    const signedJoinMsg = signedJoinMsgFactory();
    const joinReq = new JoinReq(
      signedJoinMsg.userPubkey,
      signedJoinMsg.userSig
    );
    const bytes = joinReq.serialize();
    const reqFromBytes = JoinReq.deserialize(bytes);
    expect(joinReq.userPubkey).toEqual(reqFromBytes.userPubkey);
    expect(joinReq.userSig).toEqual(reqFromBytes.userSig);
  });

  test("JoinResp", () => {
    const signedJoinMsg = signedJoinMsgFactory();
    const joinResp = new JoinResp(signedJoinMsg.hubSig);
    const bytes = joinResp.serialize();
    const reqFromBytes = JoinResp.deserialize(bytes);
    expect(joinResp.hubSig).toEqual(reqFromBytes.hubSig);
  });

  test("SearchMessage1", () => {
    const msg1Last = new SearchMessage1(true);
    const bytes = msg1Last.serialize();
    const msg1LastFromBytes = SearchMessage1.deserialize(bytes);
    expect(msg1LastFromBytes.isEnd).toBeTruthy();
    expect(msg1LastFromBytes.smpMsg1).toBeUndefined();

    const smpMsg1 = smpMessage1Factory() as SMPMessage1Wire;
    const msg1NotLast = new SearchMessage1(false, smpMsg1.toTLV());
    const msg1NotLastFromBytes = SearchMessage1.deserialize(
      msg1NotLast.serialize()
    );
    expect(msg1NotLastFromBytes.isEnd).toBeFalsy();
    if (msg1NotLastFromBytes.smpMsg1 === undefined) {
      throw new Error();
    }
    const smpMsg1FromBytes = SMPMessage1Wire.fromTLV(
      msg1NotLastFromBytes.smpMsg1
    );
    expect(smpMsg1FromBytes.g2a).toEqual(smpMsg1.g2a);
    expect(smpMsg1FromBytes.g2aProof).toEqual(smpMsg1.g2aProof);
    expect(smpMsg1FromBytes.g3a).toEqual(smpMsg1.g3a);
    expect(smpMsg1FromBytes.g3aProof).toEqual(smpMsg1.g3aProof);
  });

  test("SearchMessage3", () => {
    const msg3Base64encoded =
      "AAQBABIknI01pr5NOwtf+ReeOjfm9hbTx1DOFmPtwzU3oQmBbTj+r8gfldGtoGiLlmnV+YpQhsT9Z7e8rXzwuqKSWgEo7wtp9P1UCVmV11az/Nfq14bKdnbVdbjxKEMhBTJVFZk9hcjMs5Z+DpIg8aqCtYx26R5u5FrpciKkVVFzRU4FxSf0lIpMdD2fPQCk8TeGKs8J30jmBXOtUkW+ly4GbQX3R8G+SLz5YeTwxjN2MoMMbpqaqxtgGPMQF7Hqq9GYpcwjRrLKih2USKneklNR7vBJwHKNKNwtG8tvi73QZ1cUUPgdZfatmeiPUVKgHBbaXjwPsOd77jP/Iy7AXfCGGAEACATLeyJwcm90b2NvbCI6Imdyb3RoIiwicHJvb2YiOiIyNzE3NWE4ODliZDNlNjA0MTYyMjJiZTk2NTdlM2U2Y2Q5Nzg2ZDMwMDVjYWM5Mjg0ZTM0NDYzMTkxZGMyNmYwMGY5ODgyMDZiZmRhYzg1NDIxMTk1MWNmYWI0OGYxZjkzNjQ3MWRhNjM2OGI1NjNjMDZmZDQzOTk0YmY2NjNlODA5NDdmNjdhYjlkNWI2NjIyOTU1YmFmOGQ0ZDBlOTJkYjI5M2IxZDg4ZDRjNDg1YTAxNzM2MWE0ZTg3OTRlNmEyYjVkMTc2MmI1YTQwNDk2YWZlYjk4OTU1YzA0NDY5YzgyZTBjZTIzMmE0ZjEwMTYwMzY1ZDdhMjE1OTg4MDVmMmE5ZjZiYWFiMjFhYjBlMjA2ZWVhMjQ4N2RiODgxNzA4OGZjOTY5ZDBhZTI5MmQ4ZWEyMzA4OWU2MWJhNWIzNzI2ZGU0YjE5MDQ3MDYyNDhhMTc4ODQ1ZTBkZGFhNTU5NDM2NTNhYTg5YWIxZTdmYzdiMDkyYmExMjE1ZTExM2UwMTg5OGI4YTIxNzg0Y2FmNDExZmE1YjA2MDdkODNlYjUwNjc0M2I5ZDZiZWFjYzk4NmYyNDAyZTkyODMyYWVhMTE5NmFiMDQ2MDdmNzg2NWIwZTExYTJlYTZhYTk4Y2U5YzVhNzAwOWZiODY3NTJhYWI1ZDllZjRmMGUyM2M4ZSIsInBpX2EiOlsiMTc2ODE0NjM0MTczNzE4MjUwNjQ3OTQyOTQ3NzE2MTU1NzA1MDUyMTQ3MDM5NjAyNTU4NTc2NzAwNTQ3NDgyNjEwODcxNTMyMzU2OTYiLCI3MDU0MTUwODkxNTg0NzIyNjQyNjU4MTM3NjQ3NDMyNDQ1OTU3MjQ3ODcxNjk0Mjk5NjE1NDM1MDM0OTYyNTc1NzE2MDM3MDU5NTYwIiwiMSJdLCJwaV9iIjpbWyIxOTYxMzkzMDY2NzQ3NDU5MTg1ODkyNDAwNzE0NzQzNTkxNzY2NzU4MDExMDE2NjAxOTMxMjczNTM0NDExNzIxMzQ4ODc4Mzg1MTYxNSIsIjQxOTc5NjI5MTcxMzQxNTY4MDkwODQwODI4NDA0NjUwNTAyMDYzMTM5MjU1NTg4NzQ0MjkyNjkyNjI5Nzk3NTg3ODM5ODUxNzYxNzAiXSxbIjE3NTgwNjQ2NTk5OTg3MDgxMjgwNTIxOTk5MjA0OTY3NzE1ODQ4MTEyMjk5NTY0NTI1NDk0MzU3MTE3ODI3NTcwOTIzMTYyNDM5OTk4IiwiMTkyNzg4MTE0MTI2MDM1NTkzNjI1MzM5MDQ2NTQ0OTI4NDE3NjIzMDAzNDY5NzUzNDE2NDMxNjA0MzgyNjE2OTgyMzU3NzM2Mzk0NzkiXSxbIjEiLCIwIl1dLCJwaV9jIjpbIjY5NTMzMzk2MzE5NzU0Mjk4NTg0Mzk5ODI5NTM0NjE4NzY0MDI1MjY1Nzk3MTEzMTE2NDMxMjc5MzU5OTI0Mzk2MDg5MTY4MTUxNCIsIjc5NTU1MjU4MDIyNTk3OTIzNDc1NjAzMDgzOTU1NDg3NDE4NzQ2NjM2ODc2MTM4Nzg5ODE5MjIzMTY5NDY3MTY3NTU4NjQyMDY0NzgiLCIxIl19AAgMFFsiMSIsIjM2Njk1NzU4NDA0NDI3MzQwNTA4MDEwNjQ4Mjc5MzIzNjMyMzA4NDkzNzU1OTE0MTg2MTcxMDY1NzQ1NzM4MjM4NTcyMTU5MzMzNjAiLCI2MTczNTI4MzczNDc3OTk0OTE4NjI1NTE2MjU5ODYzMjc2MTQwMzQwMTg4NzU1ODQ0MjA0NjQ3NDYwNTQ5MjkyMDIyMTY3MTQwOTkzIiwiMTQ5MTY5ODMyNjY2MjYzMjA5MzY3MDY4MzY4OTc4ODU2NDE3NTc5MjAyODAyMTQxOTg2NDg4NTQ0OTg2NTM2MzYyODIxNzQxNzU5MDAiLCI5NTA0NDkyNTQ2MjE2NDM0MjUwMTkwMDU3NzM3NTE0NjIzNTg2ODM3MTc0NTg2MDA1MjI4NDQxOTkwMDQ1NzgyMjA5NjM4MzI0Nzc3IiwiNTA4NDc2NTI5OTc0NTMwNDM3OTM0ODQ3NTQ2Mjg0MzM0NTYzNzY0MjEyNDU2NTgzODMwMTAwNjczNTY0MTM3Nzg2NTE4NTU1NDI0NiIsIjg3NTYxNjcxNjU4NDY0MzI4NDI4MTc2MjY1NjMwNDc0Mjc4NDIwODUwODQ5NzE4NTQ0MjI3NzAzNzc0NTgzNzcyMTA3ODcwNTE5OCIsIjk5MDcxNDg0MjYyMjAxMDM0MDQyMjcyMTAwODQ1ODY4ODA3MjEzNjk2MDEzODcwMDIxNTk0MjA3NzMxNzcwMjc1NjA5NjkxNjE0NjIiLCIxMTYyMjIxMDMyNzQ0ODA3Nzk1MTI1OTc2NjAxMzA5OTQ0NjM4NDgxNzk0MTQyOTQyODkwMDYwNzgzODY5MzAzMTE0ODgxMTIzMTQ1OCIsIjE5ODA4NjM5MzQwMDk5OTg0NDc4ODI2NzE1Njg4NzgxMjIwMDIwNzYxODQ2MzIyMDA5MDU3Mzk1MzIwNzE0MDI1MzY2MDk2NjI5NiIsIjE3NjMxNzAyMjE0ODY1MDgzNjUzMjg5MjUyODI4NDQ3ODk1MzQ1MDc2MTYyMzg4MzgzNTMwMjI4MzQ4OTAzOTAwNjE3MTU4ODAwNzkzIiwiMTM5NjAxNDEwMzM2MzQxMDQ5MjExMTYwOTc5MDYzNTU3NTAwNTg3NDI5NTk4MTM2MTY3NjcwMjUxMTYxMTgyMjkxMTc1NzM5Nzg5MDkiLCI4MjY1MTIwNDk2NzIzMjMxODIzMTg2OTAyOTk2MjM2MzY4NDM1MzQ3MTIwODQ3OTYyMDA3OTY0MzQ1NDkzMzE4MDkxNjE3MTA1NTY2IiwiMjE4MDM0ODczMTY0NjA5NDU2NjA0ODA3ODE3MTUyNDM3Mjg4MzM0OTMxMDM5MjUwODc5NjUzNDg1MDg5MjQwNTkyNzQ4MDkxODM3NCIsIjg5MTc4MDg3MDk5MTA4ODk3NDkyMjI5NzYxMjY5NjI0MDgwNzM0ODA1NjA0MTIwNDA3NzEyOTczMjM2MzY1MzU0ODQyMTk2MTkzNTgiLCI2ODU4Mzc5NjI4NDk4NTQxNTIxOTQzMDQ5MjI2MDI1Mzk1OTk4NzE4MDk4MzMzNDMxNDA5MDg3ODI3MTQ0NDk3MDA2MzY2NjIwNDc5IiwiMzM2Mzg3NjA1NTgyMTk5NDI4NDIwOTU2NDE1OTYxMTc2ODM2MTU4MDc0NTI5ODkzMDQyNjg5OTgzNDE5NjMxMzQzODIxNTQ2NzkzOCIsIjEwMDQ0ODY2OTc3NzE0MTU3MjU0NjI4NjY1MjAzOTc4NzIzNjMwODMyNjc1MzUxMjAxOTUwNjc1NjQ5MzQwOTYwMTQ4NTE5ODQ4NDciLCIxNDEyMzU3NDU1MTYzMTg2NDU5ODEwOTYzMDYyMzM1NTA4MTY3MTY3NTgxNjAxNzU2NTAzMjM4OTcxOTM4MjIxOTIyNTExNTIxNTIyIiwiODI3MDA2NjEyOTE1MDEyMTMxNjE1MTcxMTMyMTEzMTk0MjEwNDM3NTkxOTczMzU5MTM3MjUyNTEwMjA2NDQwMjY1MDgyNDY2MDM2MyIsIjIxMjQzNjMxMDgwODc2NjQ4MTUzOTc4ODk2NDAwOTkzNjA2MDU2NzkwMDQ0NjQ5MTYwNjE4NjA5OTMxNTU4MjMyNzkyODkzNzgzODU4IiwiMTc2NTQ3MjE1Mjc2NzUxMTAyNjY2MjcyNTUwNDk1OTQ2NzYzNjk4OTY3NzQ3ODc5NDUwMDU4MDQ2OTI1ODI3NDI0NTcwMTY5OTE5OSIsIjg3NjgyNzA0NDYzMDM1NDc5MzQzNTc0MTI2MTQzMDU2NjA2MzQwNjIzNTQ2Mzc2ODU1NTA5NjE2OTQ5MjMzMTI5MzI0MDg4ODg5MzIiLCIxMzY4NTE1NDE1NzE2MjIyMjUyNTQwNDAyMDg2NjQ3MDM4MTI0MjI5NDMyODY3MTA0MzM5MTYxMDQxMDIxNzgwMzY4MTQ1MDM3MTgwMSIsIjk4NDEyMzk4MjU0NzE5ODg1MDcyNDEzODE0OTU2NzEyNzk0NjEyNDUxNTMwOTA4NzMyNzAzMzc1NTkyMDExNzY1OTY2MTMzNjI1NDciLCIxMTM4ODAyMjYyNzc5MTQ2MjkwNTQzMTU5Njc4NzgzNjIwNTc3NTY0NzgwOTQzNjc5MDYzODk5MTE4NDQzMDc4MjExNzYyNzU0NzI1MiIsIjIwOTQ3NjM1MTY0NjA3MzU5MDc0NDEzODE2NTk5MDAzOTM4NDUzNjc0NTMwOTYxMDQ3OTUzNTY2MzM4MTk4Njk3Mzk1NzY5MDIyMDM2IiwiMTAzMzAyNTk4NDY2NDI0MzIxMTIxNDE0MDExMDkxNTUzMjY4Mzg2NDkzMzA5ODUxNjQ3MTExMDE2NjEyNjU2NTU3Mzg5NTM0ODE4OSIsIjI0MzYyNTk4NDYyMjgwNDU0MjQ3MzkyNTMwNTU1MTYwNDM0MDk0ODY4NDMyNzcyOTUwMTA3NzAwNjUwMTc4MzgwNzk1MjQ0MjgwNzEiLCIxODY3MzIwODM1NzA2Mjk2ODAwODc1OTMwOTEzNzg2NTIyOTQxODAzMDc4MjA0NTkzMTE4OTI5MjY0ODY0MzYyNTgyODI0MzY3MjYwMCIsIjQ2OTMyNzE0MTc4NzMyMzA5MzMwNjIzOTk0NzY2ODg0NzgxMzQ0ODg5NzEzNzU2OTY4Mzg3MTQ5NTM0OTYyOTY5MDk4MTM5MzQyNiIsIjY3MzM0MTIyMjc2MjkyMDQxNTU4NTEzNDYxMDkyNDQzNzk0NTA0MzE0OTM5NzkyMDUwMjE0ODM5NDIxMjExMDM1ODQ5MzIyMzcwODYiLCI2MTIzNDExMjY1NzgzMjkzNTM0MjY3NDM5ODMxMzE2NjkxNzkzMTc2NjgwMzAxNTU0MzY4NTc0MTQ4MTI4MTAwMTc0OTQ2Nzc2MTMiLCI5NjQ5MDk3MDQ2Mzc0NzYzMzA5MDIwNzE3NDI0NTcyMTUzMzE1MzkzNjU4MDQ0NDU2ODIxNzI0MTEyMzcwODk4NDI5MTI1ODQ4ODcyIiwiMjM5OTg1NzY0MzQyNjM2NzU0MTg3MzU3NTQ1OTA1MTYyMDIwMDQ1ODIyNTk5MDU0NjQwODE1OTIzNjA1ODI0OTIyMzg5OTI2NjQ1NyIsIjI0NTQxOTMyMzk1OTMyMzIxNzIyMjg2MDg3MTgyNzQ4NDcyOTE4MTc4MTI3Njg1NDU2Nzg2ODY0ODQyNjYzODcwNTM5NzgzMzEwNzciLCIxOTQ5MTMxNzkwNzA2NjEzMzQzMjIxNzMzMTU0ODY4ODI0MDI2NzczOTM0MzE3MzU5NjU2ODAyMDEwNjMyMTYxMDI3MjM4NDkwNDgzNiIsIjE3MDA1NTgzMjUxMjgwNDU2OTkxNTczODAyMDQxMzI4MzkyMjgxOTA4Mzc0NDQyNDU4NTU1OTc3OTk5OTE2NDQxNDIyNjA2MTkwNTgzIiwiOTIwMDY4OTE3MzgwNTA1NzQ1MzMwODYyODk3MjY1MjA1Nzk3NjY1NTU0MDA1OTAxNDEyNTQwODc0NTcyNzMxMjkwODg0NDkzNDA5MiIsIjQ5NTY0ODQ5MjQwODcxOTE1MzAxNzc3OTA0NjMyMjAwMDMyODY0MTM1NzYxNTYwMjMyMDIzMzIyODcxNDcyNTI3MjA0ODIzNjYyNCJd";
    const msg3Bytes = new Uint8Array(Buffer.from(msg3Base64encoded, "base64"));
    const msg3 = SearchMessage3.deserialize(msg3Bytes);
    const msg3BytesActual = msg3.serialize();
    expect(msg3BytesActual).toEqual(msg3Bytes);
  });
});
