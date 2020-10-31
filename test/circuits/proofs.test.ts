import { stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog
} from "../../src/smp/proofs";

import { q } from "../../src/smp/v4/state";
import {
  secretFactory,
  babyJubPointFactory,
  hash
} from "../../src/smp/v4/factories";

import { compileCircuit } from "./utils";

jest.setTimeout(90000);

describe("proof of discrete log", () => {
  test("should be verified in circuit", async () => {
    const g = babyJubPointFactory();
    const x = secretFactory();
    const y = g.exponentiate(x);
    const r = secretFactory();
    const pf = makeProofDiscreteLog(hash, g, x, r, q);
    expect(verifyProofDiscreteLog(hash, pf, g, y)).toBeTruthy();
    const circuit = await compileCircuit(
      "testProofOfDiscreteLogVerifier.circom"
    );
    const circuitInputs = stringifyBigInts({
      version: BigInt(1).toString(),
      c: pf.c.toString(),
      d: pf.d.toString(),
      g: [g.point[0].toString(), g.point[1].toString()],
      y: [y.point[0].toString(), y.point[1].toString()]
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const validity = getSignalByName(circuit, witness, "main.valid").toString();
    expect(validity).toEqual("1");
  });
});
