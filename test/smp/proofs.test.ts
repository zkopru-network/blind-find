import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs
} from "../../src/smp/proofs";

import { q } from "../../src/smp/config";
import { secretFactory, babyJubPointFactory } from "../../src/smp/factories";
import { smpHash } from "../../src/smp/hash";
import { BabyJubPoint } from "../../src/smp/babyJub";
import { babyJubPointToScalar } from "../../src/smp/utils";

const version = 1;
const numTimesRetry = 100;

function hash(...args: BabyJubPoint[]): BigInt {
  return smpHash(version, ...args.map(babyJubPointToScalar));
}

function factoryExclude<T>(
  toBeExcluded: T[],
  factory: () => T,
  compareFunc: (a: T, b: T) => boolean
): T {
  for (let i = 0; i < numTimesRetry; i++) {
    let res: T = factory();
    // Naive workaround to avoid `no-loop-func` when using `Array.find`
    let found = false;
    for (const index in toBeExcluded) {
      if (compareFunc(res, toBeExcluded[index])) {
        found = true;
      }
    }
    if (!found) {
      return res;
    }
    res = factory();
  }
  throw new Error(`failed to create a value excluding ${toBeExcluded}`);
}

function babyJubPointFactoryExclude(
  toBeExcluded: BabyJubPoint[]
): BabyJubPoint {
  return factoryExclude<BabyJubPoint>(
    toBeExcluded,
    babyJubPointFactory,
    (a: BabyJubPoint, b: BabyJubPoint) => a.equal(b)
  );
}

describe("ProofDiscreteLog", () => {
  const g = babyJubPointFactory();
  const x = secretFactory();
  const y = g.exponentiate(x);
  const r = secretFactory();
  const pf = makeProofDiscreteLog(hash, g, x, r, q);
  const gAnother = babyJubPointFactoryExclude([g, y]);
  test("make and verify", () => {
    expect(verifyProofDiscreteLog(hash, pf, g, y)).toBeTruthy();
  });
  test("given wrong g", () => {
    expect(verifyProofDiscreteLog(hash, pf, gAnother, y)).toBeFalsy();
  });
  test("given wrong y", () => {
    expect(verifyProofDiscreteLog(hash, pf, g, gAnother)).toBeFalsy();
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
  test("make and verify", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, y0, y1, proof)
    ).toBeTruthy();
  });
  test("wrong g0", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, gAnother, g1, g2, y0, y1, proof)
    ).toBeFalsy();
  });
  test("wrong g1", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, gAnother, g2, y0, y1, proof)
    ).toBeFalsy();
  });
  test("wrong g2", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, gAnother, y0, y1, proof)
    ).toBeFalsy();
  });
  test("wrong y0", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, gAnother, y1, proof)
    ).toBeFalsy();
  });
  test("wrong y1", () => {
    expect(
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, y0, gAnother, proof)
    ).toBeFalsy();
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
  test("make and verify", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, y0, y1, proof)
    ).toBeTruthy();
  });
  test("wrong g0", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, gAnother, g1, y0, y1, proof)
    ).toBeFalsy();
  });
  test("wrong g1", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, gAnother, y0, y1, proof)
    ).toBeFalsy();
  });
  test("wrong y0", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, gAnother, y1, proof)
    ).toBeFalsy();
  });
  test("wrong y1", () => {
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, y0, gAnother, proof)
    ).toBeFalsy();
  });
});
