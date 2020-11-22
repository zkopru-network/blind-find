import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { bigIntFactoryExclude, deepcopyRawObj } from "../utils";
import { proofOfSMPArgsFactory } from "../../src/factories";

jest.setTimeout(90000);

describe("proof of smp", () => {
  test("", async () => {
    const s = proofOfSMPArgsFactory(4);
    const circuit = await compileCircuit("testProofOfSMP.circom");
    const verifyProofOfSMP = async args => {
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();

      return res === "1";
    };

    // Succeeds
    expect(await verifyProofOfSMP(s.args)).toBeTruthy();

    // Fails if msg1 is malformed.
    const argsInvalidMsg1 = deepcopyRawObj(s.args);
    argsInvalidMsg1.g2hProofC = bigIntFactoryExclude([s.args.g2hProofC]);
    await expect(verifyProofOfSMP(argsInvalidMsg1)).rejects.toThrow();

    // Fails if msg2 is malformed.
    const argsInvalidMsg2 = deepcopyRawObj(s.args);
    argsInvalidMsg2.g2bProofD = bigIntFactoryExclude([s.args.g2bProofD]);
    await expect(verifyProofOfSMP(argsInvalidMsg2)).rejects.toThrow();

    // Fails if msg3 is malformed.
    const argsInvalidMsg3 = deepcopyRawObj(s.args);
    argsInvalidMsg3.paqaProofD1 = bigIntFactoryExclude([s.args.paqaProofD1]);
    await expect(verifyProofOfSMP(argsInvalidMsg3)).rejects.toThrow();
  });
});
