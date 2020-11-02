import { stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog
} from "../../src/smp/proofs";

import { q } from "../../src/smp/v4/state";
import {
  secretFactory,
  hash,
  babyJubBase8Factory
} from "../../src/smp/v4/factories";

import { compileCircuit } from "./utils";
import { babyJubPointFactoryExclude } from "../utils";

jest.setTimeout(90000);

const version = 1;

describe("proof of discrete log", () => {
  test("should be verified in circuit", async () => {
    // Succeeds
    const g = babyJubBase8Factory();
    const x = secretFactory();
    const y = g.exponentiate(x);
    const r = secretFactory();
    const pf = makeProofDiscreteLog(hash, g, x, r, q);
    const gAnother = babyJubPointFactoryExclude([g, y]);

    expect(verifyProofDiscreteLog(hash, pf, g, y)).toBeTruthy();
    const circuit = await compileCircuit(
      "testProofOfDiscreteLogVerifier.circom"
    );
    const circuitInputs = stringifyBigInts({
      version: BigInt(version).toString(),
      c: pf.c.toString(),
      d: pf.d.toString(),
      g: [g.point[0].toString(), g.point[1].toString()],
      y: [y.point[0].toString(), y.point[1].toString()]
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const validity = getSignalByName(circuit, witness, "main.valid").toString();
    expect(validity).toEqual("1");

    // Fails: wrong g
    const circuitInputsWrongG = stringifyBigInts({
      version: BigInt(version).toString(),
      c: pf.c.toString(),
      d: pf.d.toString(),
      g: [gAnother.point[0].toString(), gAnother.point[1].toString()],
      y: [y.point[0].toString(), y.point[1].toString()]
    });
    const witnessWrongG = await executeCircuit(circuit, circuitInputsWrongG);
    const validityWrongG = getSignalByName(
      circuit,
      witnessWrongG,
      "main.valid"
    ).toString();
    expect(validityWrongG).toEqual("0");

    // Fails: wrong y
    const circuitInputsWrongY = stringifyBigInts({
      version: BigInt(version).toString(),
      c: pf.c.toString(),
      d: pf.d.toString(),
      g: [g.point[0].toString(), g.point[1].toString()],
      y: [gAnother.point[0].toString(), gAnother.point[1].toString()]
    });
    const witnessWrongY = await executeCircuit(circuit, circuitInputsWrongY);
    const validityWrongY = getSignalByName(
      circuit,
      witnessWrongY,
      "main.valid"
    ).toString();
    expect(validityWrongY).toEqual("0");
  });
});
