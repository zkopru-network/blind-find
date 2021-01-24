import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs
} from "../../src/smp/proofs";

import { q } from "../../src/smp/v4/state";
import { secretFactory, babyJubPointFactory } from "../../src/smp/v4/factories";
import { hash } from "../../src/smp/v4/factories";
import { babyJubPointFactoryExclude } from "../utils";

import { expect } from 'chai';

describe("ProofDiscreteLog", () => {
  const g = babyJubPointFactory();
  const x = secretFactory();
  const y = g.exponentiate(x);
  const r = secretFactory();
  const pf = makeProofDiscreteLog(hash, g, x, r, q);
  const gAnother = babyJubPointFactoryExclude([g, y]);
  it("make and verify", () => {
    expect(verifyProofDiscreteLog(hash, pf, g, y)).to.be.true;
  });
  it("given wrong g", () => {
    expect(verifyProofDiscreteLog(hash, pf, gAnother, y)).to.be.false;
  });
  it("given wrong y", () => {
    expect(verifyProofDiscreteLog(hash, pf, g, gAnother)).to.be.false;
  });
});

describe("ProofEqualDiscreteCoordinates", () => {
  const g0 = babyJubPointFactory();
  const g1 = babyJubPointFactory();
  const g2 = babyJubPointFactory();
  const x0 = secretFactory();
  const x1 = secretFactory();
  const r0 = secretFactory();
  const r1 = secretFactory();
  const y0 = g0.exponentiate(x0);
  const y1 = g1.exponentiate(x0).operate(g2.exponentiate(x1));
  const proof = makeProofEqualDiscreteCoordinates(
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
  const gAnother = babyJubPointFactoryExclude([g0, g1, g2, y0, y1]);
  it("make and verify", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, y0, y1, proof)
    ).to.be.true;
  });
  it("wrong g0", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, gAnother, g1, g2, y0, y1, proof)
    ).to.be.false;
  });
  it("wrong g1", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, gAnother, g2, y0, y1, proof)
    ).to.be.false;
  });
  it("wrong g2", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, gAnother, y0, y1, proof)
    ).to.be.false;
  });
  it("wrong y0", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, gAnother, y1, proof)
    ).to.be.false;
  });
  it("wrong y1", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, y0, gAnother, proof)
    ).to.be.false;
  });
});

describe("ProofEqualDiscreteLogs", () => {
  const g0 = babyJubPointFactory();
  const g1 = babyJubPointFactory();
  const x = secretFactory();
  const r = secretFactory();
  const y0 = g0.exponentiate(x);
  const y1 = g1.exponentiate(x);
  const proof = makeProofEqualDiscreteLogs(hash, g0, g1, x, r, q);
  const gAnother = babyJubPointFactoryExclude([g0, g1, y0, y1]);
  it("make and verify", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, y0, y1, proof)
    ).to.be.true;
  });
  it("wrong g0", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, gAnother, g1, y0, y1, proof)
    ).to.be.false;
  });
  it("wrong g1", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, gAnother, y0, y1, proof)
    ).to.be.false;
  });
  it("wrong y0", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, gAnother, y1, proof)
    ).to.be.false;
  });
  it("wrong y1", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, y0, gAnother, proof)
    ).to.be.false;
  });
});
