/**
 * Introduction to the proof algorithms can be found in
 *  - section APPENDIX  in https://cypherpunks.ca/~iang/pubs/impauth.pdf
 *  - section 2 in https://www.win.tue.nl/~berry/papers/dam.pdf
 * Implementation details can be found in the OTR spec version 4
 *  - https://github.com/otrv4/otrv4/blob/master/otrv4.md
 *
 * TODO: Change the proof types to classes?
 */

import { IGroup } from "./interfaces";
import { bigIntMod } from "./utils";

type THashFunc = (...args: IGroup[]) => BigInt;

/**
 * Proof of discrete log based on Schnorr’s protocol, which proves that we know `x`
 * s.t. `y = g**x` without leaking x.
 */
type ProofDiscreteLog = { c: BigInt; d: BigInt };

/**
 * Proof of equality of discrete coordinates based on Boudot, Schoenmakers and Traoré’s extension
 * to a protocol by Chaum and Pedersen. The proof proves that given `g0`, `g1`, `g2`, `y0` and `y1`,
 * we know `x0` and `x1` s.t. `y0 = g0**x0` and `y1 = (g1**x0)*(g2**x1)`.
 */
type ProofEqualDiscreteCoordinates = { c: BigInt; d0: BigInt; d1: BigInt };

/**
 * Proof of equality of two discrete logs, i.e. given `g0`, `g1`, `y0` and `y1`, we know `x0` s.t.
 * `y0 = g0**x0` and `y1 = g1**x1`. It's based on the protocol by Chaum and Pedersen.
 */
type ProofEqualDiscreteLogs = { c: BigInt; d: BigInt };

function makeProofDiscreteLog(
  hashFunc: THashFunc,
  g: IGroup,
  exponent: BigInt,
  randomValue: BigInt,
  q: BigInt
): ProofDiscreteLog {
  const c = hashFunc(g.exponentiate(randomValue));
  const d = bigIntMod(BigInt(randomValue) - BigInt(exponent) * BigInt(c), q);
  return { c: c, d: d };
}

function verifyProofDiscreteLog(
  hashFunc: THashFunc,
  proof: ProofDiscreteLog,
  g: IGroup,
  y: IGroup
): boolean {
  return (
    proof.c ===
    hashFunc(g.exponentiate(proof.d).operate(y.exponentiate(proof.c)))
  );
}

function makeProofEqualDiscreteCoordinates(
  hashFunc: THashFunc,
  g0: IGroup,
  g1: IGroup,
  g2: IGroup,
  exponent0: BigInt,
  exponent1: BigInt,
  randomValue0: BigInt,
  randomValue1: BigInt,
  q: BigInt
): ProofEqualDiscreteCoordinates {
  const c = hashFunc(
    g0.exponentiate(randomValue0),
    g1.exponentiate(randomValue0).operate(g2.exponentiate(randomValue1))
  );
  // d0 = (randomValue0 - exponent0 * c) % q
  const d0 = bigIntMod(BigInt(randomValue0) - BigInt(exponent0) * BigInt(c), q);
  // d1 = (randomValue1 - exponent1 * c) % q
  const d1 = bigIntMod(BigInt(randomValue1) - BigInt(exponent1) * BigInt(c), q);
  return { c: c, d0: d0, d1: d1 };
}

function verifyProofEqualDiscreteCoordinates(
  hashFunc: THashFunc,
  g0: IGroup,
  g1: IGroup,
  g2: IGroup,
  y0: IGroup,
  y1: IGroup,
  proof: ProofEqualDiscreteCoordinates
): boolean {
  return (
    proof.c ===
    hashFunc(
      g0.exponentiate(proof.d0).operate(y0.exponentiate(proof.c)),
      g1
        .exponentiate(proof.d0)
        .operate(g2.exponentiate(proof.d1))
        .operate(y1.exponentiate(proof.c))
    )
  );
}

function makeProofEqualDiscreteLogs(
  hashFunc: THashFunc,
  g0: IGroup,
  g1: IGroup,
  exponent: BigInt,
  randomValue: BigInt,
  q: BigInt
): ProofEqualDiscreteLogs {
  const c = hashFunc(
    g0.exponentiate(randomValue),
    g1.exponentiate(randomValue)
  );
  // d = (randomValue - exponent * c) % q
  const d = bigIntMod(BigInt(randomValue) - BigInt(exponent) * BigInt(c), q);
  return { c: c, d: d };
}

function verifyProofEqualDiscreteLogs(
  hashFunc: THashFunc,
  g0: IGroup,
  g1: IGroup,
  y0: IGroup,
  y1: IGroup,
  proof: ProofEqualDiscreteLogs
): boolean {
  return (
    proof.c ===
    hashFunc(
      g0.exponentiate(proof.d).operate(y0.exponentiate(proof.c)),
      g1.exponentiate(proof.d).operate(y1.exponentiate(proof.c))
    )
  );
}

export {
  THashFunc,
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs
};
