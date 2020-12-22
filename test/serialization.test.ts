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
  SearchMessage1
} from "../src/serialization";
import { smpMessage1Factory } from "../src/smp/v4/factories";
import { SMPMessage1Wire } from "../src/smp/v4/serialization";

describe("Serialization and Deserialization of wire messages", () => {
  test("GetMerkleProofReq", () => {
    const hubRegistry = hubRegistryFactory();
    if (hubRegistry.adminSig === undefined) {
      throw new Error();
    }
    const req = new GetMerkleProofReq(
      hubRegistry.pubkey,
      hubRegistry.sig,
      hubRegistry.adminSig
    );
    const bytes = req.serialize();
    const reqFromBytes = GetMerkleProofReq.deserialize(bytes);
    expect(req.hubPubkey).toEqual(reqFromBytes.hubPubkey);
    expect(req.hubSig).toEqual(reqFromBytes.hubSig);
    expect(req.adminSig).toEqual(reqFromBytes.adminSig);

    const [reqFromBytesConsumed, bytesRemaining] = GetMerkleProofReq.consume(
      bytes
    );
    expect(bytesRemaining.length).toEqual(0);
    expect(req.hubPubkey).toEqual(reqFromBytesConsumed.hubPubkey);
    expect(req.hubSig).toEqual(reqFromBytesConsumed.hubSig);
    expect(req.adminSig).toEqual(reqFromBytesConsumed.adminSig);
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
});
