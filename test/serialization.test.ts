import { genKeypair } from "maci-crypto";
import { LEVELS } from "../src/configs";
import { hubRegistryFactory, hubRegistryTreeFactory } from "../src/factories";
import { GetMerkleProofReq, GetMerkleProofResp } from "../src/serialization";

describe("Serialization of messages", () => {
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
    const merklePath: BigInt[] = [];
    const merkleRoot = BigInt(0);
    for (let i = 0; i < LEVELS; i++) {
        merklePath.push(BigInt(0));
    }
    const msg = new GetMerkleProofResp(merkleRoot, merklePath);
    const bytes = msg.serialize();
    const msgFromBytes = GetMerkleProofResp.deserialize(bytes);
    expect(msg.merkleRoot).toEqual(msgFromBytes.merkleRoot);
    expect(msg.merklePath).toEqual(msgFromBytes.merklePath);
    // const bytes = req.serialize();
    // const reqFromBytes = GetMerkleProofReq.deserialize(bytes);
    // expect(req.hubPubkey).toEqual(reqFromBytes.hubPubkey);
    // expect(req.hubSig).toEqual(reqFromBytes.hubSig);
    // expect(req.adminSig).toEqual(reqFromBytes.adminSig);

    // const [reqFromBytesConsumed, bytesRemaining] = GetMerkleProofReq.consume(
    //   bytes
    // );
    // expect(bytesRemaining.length).toEqual(0);
    // expect(req.hubPubkey).toEqual(reqFromBytesConsumed.hubPubkey);
    // expect(req.hubSig).toEqual(reqFromBytesConsumed.hubSig);
    // expect(req.adminSig).toEqual(reqFromBytesConsumed.adminSig);
  });
});
