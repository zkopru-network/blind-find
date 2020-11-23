import {
  genProof,
  genProofOfSMP,
  verifyProof,
  verifyProofOfSMP
} from "../../src/circuits/ts";
import {
  proofOfSMPInputsFactory,
  proofSuccessfulSMPArgsFactory
} from "../../src/factories";
import { bigIntFactoryExclude } from "../utils";

jest.setTimeout(300000);

describe("Test `genProof` and `verifyProof`", () => {
  test("proofOfSMP succeeds", async () => {
    const s = proofOfSMPInputsFactory(32);
    const { proof, publicSignals } = await genProofOfSMP(s);
    const res = await verifyProofOfSMP(proof, publicSignals);
    expect(res).toBeTruthy();
    // Invalid public
    const invalidPublicSignals = [...publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofOfSMP(proof, invalidPublicSignals)
    ).rejects.toThrow();
  });

  test("proofSuccessfulSMP succeeds", async () => {
    const s = proofSuccessfulSMPArgsFactory();
    const circuitName = "instance/proofSuccessfulSMP.circom";
    const { proof, publicSignals } = await genProof(circuitName, s.args);
    console.log("args = ", s.args);
    const res = await verifyProof(circuitName, proof, publicSignals);
    expect(res).toBeTruthy();
    console.log("publicSignals = ", publicSignals);
    // Invalid public
    const invalidPublicSignals = [...publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProof(circuitName, proof, invalidPublicSignals)
    ).rejects.toThrow();
  });
});
