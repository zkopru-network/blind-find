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

import { expect } from 'chai';

const version = 1;

describe("proof of discrete log", function () {
  this.timeout(90000);
  it("should be verified in circuit", async () => {
    const g = babyJubBase8Factory();
    const x = secretFactory();
    const y = g.exponentiate(x);
    const r = secretFactory();
    const pf = makeProofDiscreteLog(hash, g, x, r, q);
    const gAnother = babyJubPointFactoryExclude([g, y]);

    expect(verifyProofDiscreteLog(hash, pf, g, y)).to.be.true;

    const circuit = await compileCircuit(
      "testProofOfDiscreteLogVerifier.circom"
    );
    const verifyPfCircuit = async (
      pf: ProofDiscreteLog,
      g: BabyJubPoint,
      y: BabyJubPoint
    ) => {
      const args = stringifyBigInts({
        version: BigInt(version),
        c: pf.c,
        d: pf.d,
        g: g.point,
        y: y.point
      });
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };
    // Succeeds
    expect(await verifyPfCircuit(pf, g, y)).to.be.true;
    // Fails: wrong g
    expect(await verifyPfCircuit(pf, gAnother, y)).to.be.false;
    // Fails: wrong y
    expect(await verifyPfCircuit(pf, g, gAnother)).to.be.false;
  });
});

describe("ProofEqualDiscreteCoordinates", function() {
  this.timeout(90000);

  it("should be verified in circuit", async () => {
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
    ).to.be.true;

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
        version: BigInt(version),
        c: pf.c,
        d0: pf.d0,
        d1: pf.d1,
        g0: g0.point,
        g1: g1.point,
        g2: g2.point,
        y0: y0.point,
        y1: y1.point
      });
      const witness = await executeCircuit(circuit, circuitInputs);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };

    // Succeeds
    expect(await verifyPfCircuit(pf, g0, g1, g2, y0, y1)).to.be.true;
    // Wrong g0
    expect(await verifyPfCircuit(pf, gAnother, g1, g2, y0, y1)).to.be.false;
    // Wrong g1
    expect(await verifyPfCircuit(pf, g0, gAnother, g2, y0, y1)).to.be.false;
    // Wrong g2
    expect(await verifyPfCircuit(pf, g0, g1, gAnother, y0, y1)).to.be.false;
    // Wrong y0
    expect(await verifyPfCircuit(pf, g0, g1, g2, gAnother, y1)).to.be.false;
    // Wrong y1
    expect(await verifyPfCircuit(pf, g0, g1, g2, y0, gAnother)).to.be.false;
  });
});

describe("ProofEqualDiscreteLogs", function () {
  this.timeout(90000);

  it("should be verified in circuit", async () => {
    const g0 = babyJubPointFactory();
    const g1 = babyJubPointFactory();
    const x = secretFactory();
    const r = secretFactory();
    const y0 = g0.exponentiate(x);
    const y1 = g1.exponentiate(x);
    const pf = makeProofEqualDiscreteLogs(hash, g0, g1, x, r, q);
    const gAnother = babyJubPointFactoryExclude([g0, g1, y0, y1]);
    expect(verifyProofEqualDiscreteLogs(hash, g0, g1, y0, y1, pf)).to.be.true;

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
        version: BigInt(version),
        c: pf.c,
        d: pf.d,
        g0: g0.point,
        g1: g1.point,
        y0: y0.point,
        y1: y1.point
      });
      const witness = await executeCircuit(circuit, circuitInputs);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };
    // Succeeds
    expect(await verifyPfCircuit(pf, g0, g1, y0, y1)).to.be.true;
    // Fails: wrong g0
    expect(await verifyPfCircuit(pf, gAnother, g1, y0, y1)).to.be.false;
    // Fails: wrong g1
    expect(await verifyPfCircuit(pf, g0, gAnother, y0, y1)).to.be.false;
    // Fails: wrong y0
    expect(await verifyPfCircuit(pf, g0, g1, gAnother, y1)).to.be.false;
    // Fails: wrong y1
    expect(await verifyPfCircuit(pf, g0, g1, y0, gAnother)).to.be.false;
  });
});
