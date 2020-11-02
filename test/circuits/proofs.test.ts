import { stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs,
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs
} from "../../src/smp/proofs";

import { q } from "../../src/smp/v4/state";
import {
  secretFactory,
  hash,
  babyJubBase8Factory,
  babyJubPointFactory
} from "../../src/smp/v4/factories";

import { compileCircuit } from "./utils";
import { babyJubPointFactoryExclude } from "../utils";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";

jest.setTimeout(90000);

const version = 1;

describe("proof of discrete log", () => {
  test("should be verified in circuit", async () => {
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
    const verifyPfCircuit = async (
      pf: ProofDiscreteLog,
      g: BabyJubPoint,
      y: BabyJubPoint
    ) => {
      const args = stringifyBigInts({
        version: BigInt(version).toString(),
        c: pf.c.toString(),
        d: pf.d.toString(),
        g: [g.point[0].toString(), g.point[1].toString()],
        y: [y.point[0].toString(), y.point[1].toString()]
      });
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };
    // Succeeds
    expect(await verifyPfCircuit(pf, g, y)).toBeTruthy();
    // Fails: wrong g
    expect(await verifyPfCircuit(pf, gAnother, y)).toBeFalsy();
    // Fails: wrong y
    expect(await verifyPfCircuit(pf, g, gAnother)).toBeFalsy();
  });
});

describe("ProofEqualDiscreteCoordinates", () => {
  test("should be verified in circuit", async () => {
    const g0 = babyJubPointFactory();
    const g1 = babyJubPointFactory();
    const g2 = babyJubPointFactory();
    const x0 = secretFactory();
    const x1 = secretFactory();
    const r0 = secretFactory();
    const r1 = secretFactory();
    const y0 = g0.exponentiate(x0);
    const y1 = g1.exponentiate(x0).operate(g2.exponentiate(x1));
    const gAnother = babyJubPointFactoryExclude([g0, g1, g2, y0, y1]);
    const pf = makeProofEqualDiscreteCoordinates(
      hash,
      g0,
      g1,
      g2,
      x0,
      x1,
      r0,
      r1,
      q
    );
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, y0, y1, pf)
    ).toBeTruthy();

    const circuit = await compileCircuit(
      "testProofEqualDiscreteCoordinatesVerifier.circom"
    );

    const verifyPfCircuit = async (
      pf: ProofEqualDiscreteCoordinates,
      g0: BabyJubPoint,
      g1: BabyJubPoint,
      g2: BabyJubPoint,
      y0: BabyJubPoint,
      y1: BabyJubPoint
    ) => {
      const circuitInputs = stringifyBigInts({
        version: BigInt(version).toString(),
        c: pf.c.toString(),
        d0: pf.d0.toString(),
        d1: pf.d1.toString(),
        g0: [g0.point[0].toString(), g0.point[1].toString()],
        g1: [g1.point[0].toString(), g1.point[1].toString()],
        g2: [g2.point[0].toString(), g2.point[1].toString()],
        y0: [y0.point[0].toString(), y0.point[1].toString()],
        y1: [y1.point[0].toString(), y1.point[1].toString()]
      });
      const witness = await executeCircuit(circuit, circuitInputs);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };

    // Succeeds
    expect(await verifyPfCircuit(pf, g0, g1, g2, y0, y1)).toBeTruthy();
    // Wrong g0
    expect(await verifyPfCircuit(pf, gAnother, g1, g2, y0, y1)).toBeFalsy();
    // Wrong g1
    expect(await verifyPfCircuit(pf, g0, gAnother, g2, y0, y1)).toBeFalsy();
    // Wrong g2
    expect(await verifyPfCircuit(pf, g0, g1, gAnother, y0, y1)).toBeFalsy();
    // Wrong y0
    expect(await verifyPfCircuit(pf, g0, g1, g2, gAnother, y1)).toBeFalsy();
    // Wrong y1
    expect(await verifyPfCircuit(pf, g0, g1, g2, y0, gAnother)).toBeFalsy();
  });
});

describe("ProofEqualDiscreteLogs", () => {
  test("should be verified in circuit", async () => {
    const g0 = babyJubPointFactory();
    const g1 = babyJubPointFactory();
    const x = secretFactory();
    const r = secretFactory();
    const y0 = g0.exponentiate(x);
    const y1 = g1.exponentiate(x);
    const pf = makeProofEqualDiscreteLogs(hash, g0, g1, x, r, q);
    const gAnother = babyJubPointFactoryExclude([g0, g1, y0, y1]);
    expect(verifyProofEqualDiscreteLogs(hash, g0, g1, y0, y1, pf)).toBeTruthy();

    const circuit = await compileCircuit(
      "testProofEqualDiscreteLogsVerifier.circom"
    );

    const verifyPfCircuit = async (
      pf: ProofEqualDiscreteLogs,
      g0: BabyJubPoint,
      g1: BabyJubPoint,
      y0: BabyJubPoint,
      y1: BabyJubPoint
    ) => {
      const circuitInputs = stringifyBigInts({
        version: BigInt(version).toString(),
        c: pf.c.toString(),
        d: pf.d.toString(),
        g0: [g0.point[0].toString(), g0.point[1].toString()],
        g1: [g1.point[0].toString(), g1.point[1].toString()],
        y0: [y0.point[0].toString(), y0.point[1].toString()],
        y1: [y1.point[0].toString(), y1.point[1].toString()]
      });
      const witness = await executeCircuit(circuit, circuitInputs);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };
    // Succeeds
    expect(await verifyPfCircuit(pf, g0, g1, y0, y1)).toBeTruthy();
    // Fails: wrong g0
    expect(await verifyPfCircuit(pf, gAnother, g1, y0, y1)).toBeFalsy();
    // Fails: wrong g1
    expect(await verifyPfCircuit(pf, g0, gAnother, y0, y1)).toBeFalsy();
    // Fails: wrong y0
    expect(await verifyPfCircuit(pf, g0, g1, gAnother, y1)).toBeFalsy();
    // Fails: wrong y1
    expect(await verifyPfCircuit(pf, g0, g1, y0, gAnother)).toBeFalsy();
  });
});
