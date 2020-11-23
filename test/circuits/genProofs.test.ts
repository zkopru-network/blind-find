import {
  genProofOfSMP,
  genProofSuccessfulSMP,
  verifyProofOfSMP,
  verifyProofSuccessfulSMP,
  verifyProofIndirectConnection,
  Proof
} from "../../src/circuits/ts";
import { proofIndirectConnectionInputsFactory } from "../../src/factories";
import { bigIntFactoryExclude } from "../utils";

jest.setTimeout(300000);

describe("Test `genProof` and `verifyProof`", () => {
  const inputs = proofIndirectConnectionInputsFactory(32);
  let proofOfSMP: Proof;
  let proofSuccessfulSMP: Proof;

  beforeAll(async () => {
    proofOfSMP = await genProofOfSMP(inputs);
    proofSuccessfulSMP = await genProofSuccessfulSMP(inputs);
  });

  test("proofOfSMP succeeds", async () => {
    const res = await verifyProofOfSMP(
      proofOfSMP.proof,
      proofOfSMP.publicSignals
    );
    expect(res).toBeTruthy();
    // Invalid public
    const invalidPublicSignals = [...proofOfSMP.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofOfSMP(proofOfSMP.proof, invalidPublicSignals)
    ).rejects.toThrow();
  });

  test("proofSuccessfulSMP succeeds", async () => {
    const res = await verifyProofSuccessfulSMP(
      proofSuccessfulSMP.proof,
      proofSuccessfulSMP.publicSignals
    );
    expect(res).toBeTruthy();
    console.log("publicSignals = ", proofSuccessfulSMP.publicSignals);
    // Invalid public
    const invalidPublicSignals = [...proofSuccessfulSMP.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofSuccessfulSMP(proofSuccessfulSMP.proof, invalidPublicSignals)
    ).rejects.toThrow();
  });

  test("proof indirect connection (proofOfSMP and proofSuccessfulSMP)", async () => {
    await verifyProofIndirectConnection(proofOfSMP, proofSuccessfulSMP);
  });
});
