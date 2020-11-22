import { genProof, verifyProof } from "../../src/circuits/ts";
import {
  proofOfSMPArgsFactory,
  proofSuccessfulSMPArgsFactory
} from "../../src/factories";
import { bigIntFactoryExclude } from "../utils";

jest.setTimeout(100000);

describe("Test `genProof` and `verifyProof`", () => {
  test("proofOfSMP succeeds", async () => {
    const s = proofOfSMPArgsFactory(32);
    const circuitName = "instance/proofOfSMP.circom";
    const { proof, publicSignals } = await genProof(circuitName, s.args);
    const res = await verifyProof(circuitName, proof, publicSignals);
    expect(res).toBeTruthy();
    // Invalid public
    const invalidPublicSignals = [...publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProof(circuitName, proof, invalidPublicSignals)
    ).rejects.toThrow();
  });

  test("proofSuccessfulSMP succeeds", async () => {
    const s = proofSuccessfulSMPArgsFactory();
    const circuitName = "instance/proofSuccessfulSMP.circom";
    const { proof, publicSignals } = await genProof(circuitName, s.args);
    const res = await verifyProof(circuitName, proof, publicSignals);
    expect(res).toBeTruthy();
    // Invalid public
    const invalidPublicSignals = [...publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProof(circuitName, proof, invalidPublicSignals)
    ).rejects.toThrow();
  });
});
