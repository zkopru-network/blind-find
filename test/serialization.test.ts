import { genKeypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import {
  hubRegistryFactory,
  hubRegistryTreeFactory,
  signedJoinMsgFactory
} from "./factories";
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

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Serialization and Deserialization of wire messages", () => {
  it("GetMerkleProofReq", () => {
    const hubRegistry = hubRegistryFactory();
    const req = new GetMerkleProofReq(hubRegistry.pubkey, hubRegistry.sig);
    const bytes = req.serialize();
    const reqFromBytes = GetMerkleProofReq.deserialize(bytes);
    expect(req.hubPubkey).to.eql(reqFromBytes.hubPubkey);
    expect(req.hubSig).to.eql(reqFromBytes.hubSig);

    const [reqFromBytesConsumed, bytesRemaining] =
      GetMerkleProofReq.consume(bytes);
    expect(bytesRemaining.length).to.eql(0);
    expect(req.hubPubkey).to.eql(reqFromBytesConsumed.hubPubkey);
    expect(req.hubSig).to.eql(reqFromBytesConsumed.hubSig);
  });

  it("GetMerkleProofResp", () => {
    const hub = genKeypair();
    const tree = hubRegistryTreeFactory([hub], LEVELS);
    const merkleProof = tree.tree.genMerklePath(0);
    const msg = new GetMerkleProofResp(merkleProof);
    const bytes = msg.serialize();
    const msgFromBytes = GetMerkleProofResp.deserialize(bytes);
    expect(msg.merkleProof.pathElements).to.eql(
      msgFromBytes.merkleProof.pathElements
    );
    expect(msg.merkleProof.indices).to.eql(msgFromBytes.merkleProof.indices);
    expect(msg.merkleProof.depth).to.eql(msgFromBytes.merkleProof.depth);
    expect(msg.merkleProof.root).to.eql(msgFromBytes.merkleProof.root);
    expect(msg.merkleProof.leaf).to.eql(msgFromBytes.merkleProof.leaf);
  });

  it("JoinReq", () => {
    const signedJoinMsg = signedJoinMsgFactory();
    const joinReq = new JoinReq(
      signedJoinMsg.userPubkey,
      signedJoinMsg.userSig,
      {
        hostname: "127.0.0.1",
        port: 3333
      }
    );
    const bytes = joinReq.serialize();
    const reqFromBytes = JoinReq.deserialize(bytes);
    expect(joinReq.userPubkey).to.eql(reqFromBytes.userPubkey);
    expect(joinReq.userSig).to.eql(reqFromBytes.userSig);
  });

  it("JoinResp", () => {
    const signedJoinMsg = signedJoinMsgFactory();
    const joinResp = new JoinResp(signedJoinMsg.hubSig);
    const bytes = joinResp.serialize();
    const reqFromBytes = JoinResp.deserialize(bytes);
    expect(joinResp.hubSig).to.eql(reqFromBytes.hubSig);
  });

  it("SearchMessage1", () => {
    const msg1Last = new SearchMessage1(true);
    const bytes = msg1Last.serialize();
    const msg1LastFromBytes = SearchMessage1.deserialize(bytes);
    expect(msg1LastFromBytes.isEnd).to.be.true;
    expect(msg1LastFromBytes.smpMsg1).to.be.undefined;

    const smpMsg1 = smpMessage1Factory() as SMPMessage1Wire;
    const msg1NotLast = new SearchMessage1(false, smpMsg1.toTLV());
    const msg1NotLastFromBytes = SearchMessage1.deserialize(
      msg1NotLast.serialize()
    );
    expect(msg1NotLastFromBytes.isEnd).to.be.false;
    if (msg1NotLastFromBytes.smpMsg1 === undefined) {
      throw new Error();
    }
    const smpMsg1FromBytes = SMPMessage1Wire.fromTLV(
      msg1NotLastFromBytes.smpMsg1
    );
    expect(smpMsg1FromBytes.g2a).to.eql(smpMsg1.g2a);
    expect(smpMsg1FromBytes.g2aProof).to.eql(smpMsg1.g2aProof);
    expect(smpMsg1FromBytes.g3a).to.eql(smpMsg1.g3a);
    expect(smpMsg1FromBytes.g3aProof).to.eql(smpMsg1.g3aProof);
  });

  it("SearchMessage3", () => {
    const msg3Base64encoded =
      "AAQBAAJ6HlNdEbe23RCfkIU4CAP/prP2063MAsxFTK0iiqYUuuaqO1JGNlcBy1zYxYoAayyuXGnLTBdiCglDdJv4foVNkSAAAXZ0ifvIA3C+FtGBA5yNyesc0lfX9Ax9PEAcIvSXLz0KwijejimseW80e3Q1E+lYsdc9iGdeQGK4W4wANTcrcDdFwS98VM2VpTyjCtJM2aCaIPY9/Trus9+CzgK0d2XxXCW/EdgPvTC2AYB9LYrxIHWDKcdo1vZiMjiiJ1W5gsSZD7q7rRKxTfPjZ8K3C1B/t9mAmaruNi+7RhYDFCpLay5agWiUzzAd1OtWCMftc2a770RhqzKASgRSqQEACALTeyJwaV9hIjpbIjE1ODU2MDUxMTMyMTQ5NTc1MzYwNzQ5ODM3MTYzNDExMzk5MjUzMDUwODIwMzIzNTI4Nzk4MTI1NDAzOTQyODkyODcyNzc5NjEyMzYxIiwiMTYwMDMxNDAyMDAxMzkwMzM4MTE5MTU1NzAwNTAzMzkwODU3MTE2NDc5NzI5NTMwNjE5NTYxMjE0NDMyMTI0NjE4NzEzMjEyNDEyNSIsIjEiXSwicGlfYiI6W1siOTQ3NTcyOTM2NTE0ODM4OTI5ODEyMjE2ODQyMDM2Njc0MDkwMTg1NDYxMDQxNzA5NDMxNDY0MzY0NDE0NTkxMTk0MjAxNTY5NzU2MiIsIjIwODgxMzgzNDg0Njk0NjM2NzAyOTYxNTk5NjQ1OTc3MDg3Nzc5NjcwOTE1NzU1ODI4NTY4MTQ0NzgyNjE4MDE0NDM5ODY1NjA3OTQ3Il0sWyIxNzI0NDI1OTU1Mjc0NDUyMzg4NzQzNDc1MDg3MTk3Mjk1MjE4OTEwNTI5NTU1MjI4ODg1NzA2Njc3ODkxMDY5MzI5OTIyMzgyNzAyIiwiMTYxNzQwMTY2NTA0MzgyNzEyMjM4NzcwMzEwNzQ2NzgyODEwMTI2ODU4MDA2MDM5MjAzNTU2Mzk1ODcyMTExMDI4NjQxMzM1NDIxODkiXSxbIjEiLCIwIl1dLCJwaV9jIjpbIjEwNjg4NjY0Mjk2Njc1NjMzNTA2OTY1ODI3NjUzMzE0OTI5MzA0OTg2ODE5NzQ2NTk5MTk0Nzg2NzY2NzYxODgyODE0Mzc1Mjg3NjEyIiwiMjY4MzAzODkxODg4ODYwNzIyNDMxOTkwMzEwMzM0NTQwMzM2MTg0OTYwODgwODAyNzQ4NjI4NjU2MDUzNTYxMzE2NzE1ODg1NDg5NyIsIjEiXSwicHJvdG9jb2wiOiJncm90aDE2IiwiY3VydmUiOiJibjEyOCJ9AAgLrFsiMSIsIjQ4OTQ4OTM5NDI0MTM5MzY2MjE0NTcyODA5Nzc4MzY4ODMwNzExNzkzODg1ODUyNDE3NTQxMTAyNDQ3Njc1MjcxMzY5MTY0OTM0ODQiLCIxOTc3MjQ5NDc5MDQxMTM3MzE4NTE3NTAyNDYxMzcxODIwMzYyMDk2Njk2NjQ5MjI5MTg3MzU4NzAyNzUzOTMwMTY2MjU2OTQ4NDE5OSIsIjEzOTA4NDkyOTU3ODYwNzE3NjgyNzYzODA5NTAyMzg2NzUwODM2MDg2NDU1MDk3MzQiLCIyNDg2MTE5MTY3OTI1NzM4MzQzMDE4ODEyNjYxMDIwNzcxMzU3MzIzMzA2NjQ4NjA1MzQ4MTAwNDYwNTg2MzI0Mjc2OTIyODYyNjkwIiwiODcwODU4NjIxMDc5NDk2MzgyMTg0MTIzNDY1MTYwMDY2NjUzOTIzNjc5MDg1MjcyMTk0MjU5MzA1Nzk5MDIyNzg2NjkxNzU4MzkzOCIsIjE5MDgwNjUyOTYzOTY2Nzg1ODE1NDM5NzQ1MDgwNjcyMjA2MjAyOTIzOTM0MDkyMjI3MTMzMzk4NjMxMzE3OTM0MTUxMTY5OTU4Nzk4IiwiNjcyMDgzNDgxMTU4NjM4NjgxMTc2NzcxNDAxMjI1MDQ5ODM1NTcxNzg3MjE1MDUyMDc4NTcyNzU5ODY3MDY0NTcyMjU4MjI1MzM0NiIsIjEzOTU5NzYwNzAxMTA5NDQ5NzQ4ODA4NjY3NjE5MDY0ODIwNTU2MDc0Mjg4MjIwNDgyMDQ3ODU2NTkzMTg0OTczNjEzMjMwMTUxNDQiLCIxNzA4OTUyMTk1NDA2NjQxMDE1ODExMDI3NDE2NjA4MzQ5NDk3NTgzMDIwNTI3NTMyNzQwNDcwMzU4MjEzNDAyMjcwNjg2MjU4MjQwNSIsIjEyNDUyOTczNjAwNjM0OTk4MTU3NzMwOTE4MTA5ODEyMjY2NTg1ODc0MTM2ODA0Mjk0NTQ3NTU2MTg1NzE2OTY1NjY0ODI3ODYwNDE1IiwiNzE3ODE1NTY3NTIwOTYzNTA0NDQwNDczMDkzMjMyNjg3MzM5MjQ0NzQwNDAxMTUzODczMDAzMzcyMzAzMzU3OTEzNjgwOTQyMTQzMCIsIjEzNzM1MDg3NTM0NzU5NzQzMjg2NjQ3NjI0NzM4Mjk4ODUwNzkzNDg0Mzc4ODcwNTc2NDMwNzY1OTkxMzU5NTQ2MDk1ODI4OTg3MDIiLCIxMDM5ODIyMzQ1MzQyOTg2MDczMzY4MTM1ODQ2Nzc2MDU2MDQyNTUyMzk4NjU5MTM1Nzg0MjEwNTg2NjQzNzU2MDQ1Mzk3MDkxNzUyNyIsIjY2NzA4Mjg4NzA3Njg4MjQzNjY3OTYwNDczMzY3MzQzMjA4MjI2NzczOTY4ODA2NDI5MDUyNjI1MDc0NDc0MTgwNTI1MDA5NTA4MzEiLCI4OTYxMzcwMjE1MTY4ODAzNTI1NjUxMDQ3NTM1OTk2Njg5MDU4MTg1OTE2ODIwMDE4MTQ3MTYyMjA4MDExMDcyMzE5MjEzNjk3NDAxIiwiMjAzNTEyMjkxMjY3NTAxMjQ2Nzk2OTIzNTcwMjI0MDE5NTUwMzYxNDc1MjcwNDAzNzQzNDk4MjM5MDcwNjY1MzA3MDcwNzUwMTY4NiIsIjQzNjEwNjkxNDMxMjg1MjMwMjQxMTY0MTIyNTgyNTQzODg0MTUzNTA2NjUwMDM2MTg1Mzg3MjQ3NjA4NzIxNDY2OTYzODkzNTU3OCIsIjM1NjQwMTQ1OTA2MDUwNTM1ODI2NTMzNzA0NTQzOTA0OTIzNTk3ODA0NDcxOTQ4MjcwNzQwMDI4MDEwODU1NDk1MDI3NzY5NzI4MSIsIjE3Nzk4NDEyNjA3NDUxNzc2OTMyNzQ0MjgzMzgzNjc1MDMzODc5NDk1MjI0MTQ4NjgzMTEzNTAyMzYyMDQyOTU5NTQ3MDc5MjYyMTkzIiwiMTY2MTY2MDg4MTY5Njg2MjIyNTg1NTg4OTk5NzYxMzEzOTAxOTU2Njc3MDg4OTE0NTM2NTYwNDUzMzE5MzU0MjYwODE5OTM5NTIwOSIsIjE2MzA2NTg3MDY4MzIyNTg4MjA0ODc1NjY3NDMzOTU5MjQyMjMyNDQ1OTIzMTQ0MjMwNjE3MDczOTY5NjI4NzA3NDU2NjQ2MzM2NDM4IiwiMTc0MDEyOTc1NTgyNzUzMDk0OTc3ODc5MTcyNjkwNTE4MDI1MDc0NTQyODAzOTU5NDI5Mjc0MzgwNTk0ODUwMDYyOTc4ODQ4NjEwMzciLCIxNTE0MjA5NDA0MzUwNzAyMjk0MjI3Mjg4NTU1NTE1NzI3Mjg1MDEzMTUwODM2MDgyNzExOTIxNTE1NTgyMTQ3Njg1NjE3NDU3MTM3MSIsIjIwNzM1MjMyOTQ2NDEzNjY1Mzc4MDUwMjUwNTkzMzczMjU5MTEzNTMyODQ3NzE3Njk1NTQ1OTk4ODEwOTE3NTY5MTE3MDI3NTM0MDY1IiwiNDk0NjUwMTY1NDEyOTIwNjIzMTA5MTQyMTY2MDE0NDU5ODQ2NjcxNzg4MTI5NTQ4NjUzMjQ3ODU5MDY0MzQ4NzYwNzM2NjE5MzUzNyIsIjE3NTk3MzkyOTg3OTEwNzYxNTg0Njc0NzY4NDEzNjQzOTMxMzI1MDU3MDQ0ODk0MTA4MTUwNzE5OTA3MTM3NjA1MDA0Mjk4ODI4NTMiLCI4ODg1NDU1NzU4NDA0NDM4ODIxMTMyNzY2MzU5MjE0MTQ4ODQxODQwMDIxODk5Njc1ODI2NzM1NzI5ODMxMDU3NDExMjM4ODg5NzkiLCIxNjYwNTQ5ODc5MzczODIwNDM3NDE3MTQ5NzY4NDkxMzY2MDAyMTIxOTU5NDkwNjEyMjcxODM5MDUxMjYzMDU3MDMyNDU5NjIyMDQzIiwiOTM0MDUwNjk2MDMwMjk4NjU1MTY3MzY3NzkxODg5MDc1MjEwOTE2MjE0MjY0NjQ3MjE4OTg2ODQ2Mzc3NTg0NDU2NTgwNTU5NTEzOCIsIjEyNDcxMzU1ODQ2MzA3MjQyMzA0OTM1ODAyNTI4NjM5NTI5MDQyMDkyMDg4MTcxNzE4MjI1ODA0MjY5Nzc4NzUzMjExMzYxNjMxMzIzIiwiMjQ4NTkwMjc5NzIwNzk0ODM5ODA2ODkzMjUyNDUwOTUwODY5MDI0NjE1NzM5NzMxNzQ1MzA1NDQxMDU3OTYyNjQyOTkzNTk2OTk3OCIsIjE1NDI4NTUxOTEyMTc3MjEzMDA3ODk2NzgwMTU1NTE5NTM4NjQ1OTU3Nzg4OTEwMjIwMTQxNTAzMDE4NjU3ODI2MzU3NjE4MTg0NTI1IiwiMjQ3OTkxNjE4OTYzODAyODYxNjU4MDU2NzUxMDE5OTQwNDQ0OTAxMzQ3OTg5ODI1NjkxMDEyNTQ3MTUzNTA4NzEzODY3NzQ1MjY4IiwiMTI2OTQ5OTQ1MDU1Mjk3MjAxODM5MDc5MjU1MjY3ODUwODQyNjc2MzY2NjcwNDk4NDQ5MjQzNDk2MjUzNzM0NDQ5MTUyMTI1OTMxNyIsIjYzMzg5MDg0NzQxNDM1MjU4ODI3MjExMjc3OTMzOTgxNDkzNzM4NDU1NDg5MDA1MDIyMTg2NTE0Njg1Njk2NjUyNTEyNDYxOTAzNzAiLCIxNzkyNjgxODE3NTQ1NjM4ODY5MzI5MzU3NDkwMDM4MjA5MDE0NTg1MTk4MTUwMjE2ODI5NDUyNTU2NDAzNjc4ODA2MTE1MjMxMTIyMCIsIjEzOTYyOTczNDk5MDE1MDEyNTkwNzczMTAyNzg5MDg4NDEwOTgzOTM1MTgwMjY2MzQ2OTA5MTI3MDkzNDE5NTYwNTc5MTA2NTUzMTciLCI3NTE0NzYwNjE0MTY4ODM5ODY4ODUxODYyNTU5NzAwMTQ3MzgxNzQ0MzUyNTc2NDU3ODAzNTc1OTY3NTg2OTk4MzA3MjIzNzQxNjQiXQAIBLZ7Iml2IjoiMTYzODgwNTM1NjQ5MzE5MzUzMTExNjEzNzM1NDg4NTg1MDAwMzI0MjE5NDg3ODE3OTk0MTk3MzUyMTM1NzY1NTY5MTk0NzgzMDAxMjUiLCJkYXRhIjpbIjc3MjUyMTE1NDIwNjI5MTQyNzgzMDA2Njc1NzA4MjE2OTY0NzQ2MzgyNTM1MjQzMzM2NDYwMzg0MTUxNjI4NDczNDM0NjY0ODc0MTAiLCIyMTAzMDk2MzI1MjEzMTU3MTcxNTc3ODQ2NzQ4OTgxMzgwNTQ5OTczNDQyMTE0OTkwNTA2NzIwMjg4NjExOTc0MDE3ODY2ODMwMDExNSIsIjEwMjc2MTI2MDM0NjAxNTM5NzgwMzExNTc1ODExNTk1NTk4ODc3MjIwODQzNzE2ODg0OTE4MjM5MTI5NzIzMTA2ODAzMDU4NTUzOTk0IiwiMTA0NzMzOTc5MTE5NTg4NzMyNzA2MDM2ODA3NDU3OTMxNzAzNTYwMzcwMjU4OTM4NzMyMDg3OTM0MDEyMDgzMzgyNDQzMjYwNjYxMjciLCI3ODk1MDk5NzgxOTgzOTk4MjA1MDEyNjU2MDAyMzkwMTM4MDQyMDkyNjMzNTQyMTA1ODg4MTk4Njk0NTM1OTU4NzMyMzYxMDg4ODIxIiwiODY5MTAzMzU4MjYyMjcxODc5MDIxMDA0ODMwODMwNTkwMjA5ODk1MTAxMTE2MzUyMjA0MDQ3OTcwOTQxODE5ODUzMTIxMjM3MjU4MiIsIjI3NDUwMTUxMTM5MTQ1NTgyMTQ4ODE4NTYwMTIzOTk1NjMwNTk2MzM4ODI1MzU2MTQ5MjQ5MDQwNTc3NDQyMDE4OTkyNTgxODEzNzAiLCI3NTA0ODUxMDc2OTQwMDQ0MDkwMzk3MTE1NDk0NDY3NjEwMTUyODMyMzg5NTkyOTI0ODA1NTUxNjQ0MzE3NzAyMDEwNjgyMDAyOSIsIjEwMzkzNzIwOTY1MTU1OTU3NjgzOTA3NDI0MzU3MTU3NTEzNjY3NjI3OTIxNjc0ODQ5ODkyODU3MTA2Njk2MzUxNTEzMTkwNjUwNzQwIiwiMjAwNDgwNjA4MjcwNTUxNTQyODc1Nzk5NDAwNjg4NTI3NzEyNjExMjkxMzAzNDE1NDI0ODEyNDAzODY2MDc3NTc4MDI5NzA1NDcxOTciLCIxNTE0ODg4NDgyNzI0MTExNDAxMDk0MjM4NjE0MzM3MzQyMzY5MjcxNzQ1Nzc0Nzk0NzMyMzY3MzAwNzcwMzcwOTc5NTU5MDgxNDUwNiIsIjE4NDYxNDk5OTIzMDQ2ODU3OTM3ODI0MDI2MDE0MzcxODI1ODMyMjAyNzA0MzAxMTE2Mzk5NDg5MjYzMjMxODExMzM3MDU1MTY0ODU5IiwiMTg2MjgzMDQ1MDgyNDY4NjI3NTk3OTE1MjU4NTk3NjI4MDUxODE0ODE2MDIzMjgxNTYxMjgzMTgzNzA2MjY0NDExNTU4MDY2NTkwODIiLCI1NTkzMTI3ODkwODg3NzgwODYzMTY5MjYxOTk5NDkwMTAxMjIxMDIyNjMwNzIyNjE0Mjk2ODQyMDQwMDkzOTA5ODA0NTcwOTA5MDUiXX0=";
    const msg3Bytes = new Uint8Array(Buffer.from(msg3Base64encoded, "base64"));
    const msg3 = SearchMessage3.deserialize(msg3Bytes);
    const msg3BytesActual = msg3.serialize();
    expect(msg3BytesActual).to.eql(msg3Bytes);
  });
});
