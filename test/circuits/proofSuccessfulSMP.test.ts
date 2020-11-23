import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { babyJubPointFactoryExclude, bigIntFactoryExclude } from "../utils";
import { proofSuccessfulSMPInputsFactory } from "../../src/factories";
import { proofSuccessfulSMPInputsToCircuitArgs } from "../../src/circuits/ts";

jest.setTimeout(90000);

describe("Circuit of the Proof of Successful SMP", () => {
  const inputs = proofSuccessfulSMPInputsFactory();
  test("", async () => {
    const circuit = await compileCircuit("testProofSuccessfulSMP.circom");

    const verifyProofSuccessfulSMP = async inputs => {
      const args = proofSuccessfulSMPInputsToCircuitArgs(inputs);
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };

    // Succeeds
    expect(await verifyProofSuccessfulSMP(inputs)).toBeTruthy();

    // Fails when wrong arguments are given.
    const sAnother = bigIntFactoryExclude([inputs.a3]);
    const gAnother = babyJubPointFactoryExclude([
      inputs.pa,
      inputs.ph,
      inputs.rh
    ]);
    await expect(
      verifyProofSuccessfulSMP({
        a3: sAnother,
        pa: inputs.pa,
        ph: inputs.ph,
        rh: inputs.rh
      })
    ).rejects.toThrow();
    await expect(
      verifyProofSuccessfulSMP({
        a3: inputs.a3,
        pa: gAnother,
        ph: inputs.ph,
        rh: inputs.rh
      })
    ).rejects.toThrow();
    await expect(
      verifyProofSuccessfulSMP({
        a3: inputs.a3,
        pa: inputs.pa,
        ph: gAnother,
        rh: inputs.rh
      })
    ).rejects.toThrow();
    await expect(
      verifyProofSuccessfulSMP({
        a3: inputs.a3,
        pa: inputs.pa,
        ph: inputs.ph,
        rh: gAnother
      })
    ).rejects.toThrow();
  });
});
