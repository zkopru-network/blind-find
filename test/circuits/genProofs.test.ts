import {
  genProofOfSMP,
  genProofSuccessfulSMP,
  verifyProofOfSMP,
  verifyProofSuccessfulSMP
} from "../../src/circuits/ts";
import {
  proofOfSMPInputsFactory,
  proofSuccessfulSMPInputsFactory
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
    const s = proofSuccessfulSMPInputsFactory();
    const { proof, publicSignals } = await genProofSuccessfulSMP(s);
    const res = await verifyProofSuccessfulSMP(proof, publicSignals);
    expect(res).toBeTruthy();
    console.log("publicSignals = ", publicSignals);
    // Invalid public
    const invalidPublicSignals = [...publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofSuccessfulSMP(proof, invalidPublicSignals)
    ).rejects.toThrow();
  });
});
