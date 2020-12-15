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
  JoinResp
} from "../src/serialization";

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
});
