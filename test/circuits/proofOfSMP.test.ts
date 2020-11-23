import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { bigIntFactoryExclude, deepcopyRawObj } from "../utils";
import { proofOfSMPInputsFactory } from "../../src/factories";
import { proofOfSMPInputsToCircuitArgs } from "../../src/circuits/ts";

jest.setTimeout(300000);

describe("proof of smp", () => {
  test("", async () => {
    const s = proofOfSMPInputsFactory(4);
    const args = proofOfSMPInputsToCircuitArgs(s);
    const circuit = await compileCircuit("testProofOfSMP.circom");
    const verifyProofOfSMP = async args => {
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();

      return res === "1";
    };

    // Succeeds
    expect(await verifyProofOfSMP(args)).toBeTruthy();

    // Fails if msg1 is malformed.
    const argsInvalidMsg1 = deepcopyRawObj(args);
    argsInvalidMsg1.g2hProofC = bigIntFactoryExclude([args.g2hProofC]);
    await expect(verifyProofOfSMP(argsInvalidMsg1)).rejects.toThrow();

    // Fails if msg2 is malformed.
    const argsInvalidMsg2 = deepcopyRawObj(args);
    argsInvalidMsg2.g2bProofD = bigIntFactoryExclude([args.g2bProofD]);
    await expect(verifyProofOfSMP(argsInvalidMsg2)).rejects.toThrow();

    // Fails if msg3 is malformed.
    const argsInvalidMsg3 = deepcopyRawObj(args);
    argsInvalidMsg3.paqaProofD1 = bigIntFactoryExclude([args.paqaProofD1]);
    await expect(verifyProofOfSMP(argsInvalidMsg3)).rejects.toThrow();
  });
});
