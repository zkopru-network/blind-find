import {
  genProofOfSMP,
  genProofSuccessfulSMP,
  verifyProofOfSMP,
  verifyProofSuccessfulSMP,
  verifyProofIndirectConnection,
  Proof
} from "../../src/circuits/ts";
import { proofIndirectConnectionInputsFactory } from "../../src/factories";
import { babyJubPointFactory } from "../../src/smp/v4/factories";
import { bigIntFactoryExclude, factoryExclude } from "../utils";

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
    const res = await verifyProofOfSMP(proofOfSMP);
    expect(res).toBeTruthy();
    // Invalid public
    const invalidPublicSignals = [...proofOfSMP.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofOfSMP({
        proof: proofOfSMP.proof,
        publicSignals: invalidPublicSignals
      })
    ).rejects.toThrow();
  });

  test("proofSuccessfulSMP succeeds", async () => {
    const res = await verifyProofSuccessfulSMP(proofSuccessfulSMP);
    expect(res).toBeTruthy();

    // Invalid public
    const invalidPublicSignals = [...proofSuccessfulSMP.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofSuccessfulSMP({
        proof: proofSuccessfulSMP.proof,
        publicSignals: invalidPublicSignals
      })
    ).rejects.toThrow();
  });

  test("proof indirect connection (proofOfSMP and proofSuccessfulSMP)", async () => {
    const res = await verifyProofIndirectConnection(
      inputs.pubkeyA,
      inputs.pubkeyC,
      inputs.pubkeyAdmin,
      inputs.root,
      proofOfSMP,
      proofSuccessfulSMP
    );
    expect(res).toBeTruthy();

    // Fails when invalid public keys are passed.
    const anotherPubkey = factoryExclude(
      [inputs.pubkeyA, inputs.pubkeyC, inputs.pubkeyAdmin],
      () => {
        return babyJubPointFactory().point;
      },
      (a, b) => a === b
    );
    const anotherRoot = bigIntFactoryExclude([inputs.root]);
    // Wrong pubkeyA
    expect(
      await verifyProofIndirectConnection(
        anotherPubkey,
        inputs.pubkeyC,
        inputs.pubkeyAdmin,
        inputs.root,
        proofOfSMP,
        proofSuccessfulSMP
      )
    ).toBeFalsy();
    // Wrong pubkeyC
    expect(
      await verifyProofIndirectConnection(
        inputs.pubkeyA,
        anotherPubkey,
        inputs.pubkeyAdmin,
        inputs.root,
        proofOfSMP,
        proofSuccessfulSMP
      )
    ).toBeFalsy();
    // Wrong pubkeyAdmin
    expect(
      await verifyProofIndirectConnection(
        inputs.pubkeyA,
        inputs.pubkeyC,
        anotherPubkey,
        inputs.root,
        proofOfSMP,
        proofSuccessfulSMP
      )
    ).toBeFalsy();
    // Wrong root
    expect(
      await verifyProofIndirectConnection(
        inputs.pubkeyA,
        inputs.pubkeyC,
        inputs.pubkeyAdmin,
        anotherRoot,
        proofOfSMP,
        proofSuccessfulSMP
      )
    ).toBeFalsy();
  });
});
