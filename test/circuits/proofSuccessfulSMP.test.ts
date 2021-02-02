import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { babyJubPointFactoryExclude, bigIntFactoryExclude } from "../utils";
import { proofSuccessfulSMPInputsFactory } from ".././factories";
import { proofSuccessfulSMPInputsToCircuitArgs } from "../../src/circuits/ts";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Circuit of the Proof of Successful SMP", function() {
  this.timeout(90000);

  const inputs = proofSuccessfulSMPInputsFactory();
  it("", async () => {
    const circuit = await compileCircuit("testProofSuccessfulSMP.circom");

    const verifyProofSuccessfulSMP = async inputs => {
      const args = proofSuccessfulSMPInputsToCircuitArgs(inputs);
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };

    // Succeeds
    expect(await verifyProofSuccessfulSMP(inputs)).to.be.true;

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
    ).to.be.rejected;
    await expect(
      verifyProofSuccessfulSMP({
        a3: inputs.a3,
        pa: gAnother,
        ph: inputs.ph,
        rh: inputs.rh
      })
    ).to.be.rejected;
    await expect(
      verifyProofSuccessfulSMP({
        a3: inputs.a3,
        pa: inputs.pa,
        ph: gAnother,
        rh: inputs.rh
      })
    ).to.be.rejected;
    await expect(
      verifyProofSuccessfulSMP({
        a3: inputs.a3,
        pa: inputs.pa,
        ph: inputs.ph,
        rh: gAnother
      })
    ).to.be.rejected;
  });
});
