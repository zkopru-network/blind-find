import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { bigIntFactoryExclude, deepcopyRawObj } from "../utils";
import { proofOfSMPInputsFactory } from "../../src/factories";
import { proofOfSMPInputsToCircuitArgs } from "../../src/circuits/ts";

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("proof of smp", function() {
  this.timeout(300000);
  let circuit;
  const s = proofOfSMPInputsFactory(4);
  const args = proofOfSMPInputsToCircuitArgs(s);

  before(async () => {
    circuit = await compileCircuit("testProofOfSMP.circom");
  });

  const verifyProofOfSMP = async args => {
    const witness = await executeCircuit(circuit, args);
    const res = getSignalByName(circuit, witness, "main.valid").toString();

    return res === "1";
  };

  it("succeeds", async () => {
    // Succeeds
    expect(await verifyProofOfSMP(args)).to.be.true;
  });

  it("fails if msg1 is malformed", async () => {
    const argsInvalidMsg1 = deepcopyRawObj(args);
    argsInvalidMsg1.g2hProofC = bigIntFactoryExclude([args.g2hProofC]);
    expect(verifyProofOfSMP(argsInvalidMsg1)).to.be.rejected;
  });


  it("fails if msg2 is malformed", async () => {
    const argsInvalidMsg2 = deepcopyRawObj(args);
    argsInvalidMsg2.g2bProofD = bigIntFactoryExclude([args.g2bProofD]);
    expect(verifyProofOfSMP(argsInvalidMsg2)).to.be.rejected;
  });

  it("fails if msg3 is malformed", async () => {
    const argsInvalidMsg3 = deepcopyRawObj(args);
    argsInvalidMsg3.paqaProofD1 = bigIntFactoryExclude([args.paqaProofD1]);
    expect(verifyProofOfSMP(argsInvalidMsg3)).to.be.eventually.rejected;
  });
});
