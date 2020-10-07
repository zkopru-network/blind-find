/**
 * Introduction to the proof algorithms can be found in
 *  - section APPENDIX  in https://cypherpunks.ca/~iang/pubs/impauth.pdf
 *  - section 2 in https://www.win.tue.nl/~berry/papers/dam.pdf
 * Implementation details can be found in the OTR spec version 3
 *  - https://otr.cypherpunks.ca/Protocol-v3-4.1.1.html
 *
 * TODO: Change the proof types to classes?
 */

import BN from 'bn.js';

import { MultiplicativeGroup } from './multiplicativeGroup';

type THashFunc = (...args: BN[]) => BN;

/**
 * Proof of discrete log based on Schnorr’s protocol, which proves that we know `x`
 * s.t. `y = g**x` without leaking x.
 */
type ProofDiscreteLog = { c: BN; d: BN };
/**
 * Proof of equality of discrete coordinates based on Boudot, Schoenmakers and Traoré’s extension
 * to a protocol by Chaum and Pedersen. The proof proves that given `g0`, `g1`, `g2`, `y0` and `y1`,
 * we know `x0` and `x1` s.t. `y0 = g0**x0` and `y1 = (g1**x0)*(g2**x1)`.
 */
type ProofEqualDiscreteCoordinates = { c: BN; d0: BN; d1: BN };
/**
 * Proof of equality of two discrete logs, i.e. given `g0`, `g1`, `y0` and `y1`, we know `x0` s.t.
 * `y0 = g0**x0` and `y1 = g1**x1`. It's based on the protocol by Chaum and Pedersen.
 */
type ProofEqualDiscreteLogs = { c: BN; d: BN };

function makeProofDiscreteLog(
  hashFunc: THashFunc,
  g: MultiplicativeGroup,
  exponent: BN,
  randomValue: BN,
  q: BN
): ProofDiscreteLog {
  const c = hashFunc(g.exponentiate(randomValue).value);
  const d = randomValue.sub(exponent.mul(c)).umod(q);
  return { c: c, d: d };
}

function verifyProofDiscreteLog(
  hashFunc: THashFunc,
  proof: ProofDiscreteLog,
  g: MultiplicativeGroup,
  y: MultiplicativeGroup
): boolean {
  return proof.c.eq(
    hashFunc(g.exponentiate(proof.d).operate(y.exponentiate(proof.c)).value)
  );
}

function makeProofEqualDiscreteCoordinates(
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  g2: MultiplicativeGroup,
  exponent0: BN,
  exponent1: BN,
  randomValue0: BN,
  randomValue1: BN,
  q: BN
): ProofEqualDiscreteCoordinates {
  const c = hashFunc(
    g0.exponentiate(randomValue0).value,
    g1.exponentiate(randomValue0).operate(g2.exponentiate(randomValue1)).value
  );
  // d0 = (randomValue0 - exponent0 * c) % q
  const d0 = randomValue0.sub(exponent0.mul(c)).umod(q);
  // d1 = (randomValue1 - exponent1 * c) % q
  const d1 = randomValue1.sub(exponent1.mul(c)).umod(q);
  return { c: c, d0: d0, d1: d1 };
}

function verifyProofEqualDiscreteCoordinates(
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  g2: MultiplicativeGroup,
  y0: MultiplicativeGroup,
  y1: MultiplicativeGroup,
  proof: ProofEqualDiscreteCoordinates
): boolean {
  return proof.c.eq(
    hashFunc(
      g0.exponentiate(proof.d0).operate(y0.exponentiate(proof.c)).value,
      g1
        .exponentiate(proof.d0)
        .operate(g2.exponentiate(proof.d1))
        .operate(y1.exponentiate(proof.c)).value
    )
  );
}

function makeProofEqualDiscreteLogs(
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  exponent: BN,
  randomValue: BN,
  q: BN
): ProofEqualDiscreteLogs {
  const c = hashFunc(
    g0.exponentiate(randomValue).value,
    g1.exponentiate(randomValue).value
  );
  // d = (randomValue - exponent * c) % q
  const d = randomValue.sub(exponent.mul(c)).umod(q);
  return { c: c, d: d };
}

function verifyProofEqualDiscreteLogs(
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  y0: MultiplicativeGroup,
  y1: MultiplicativeGroup,
  proof: ProofEqualDiscreteLogs
): boolean {
  return proof.c.eq(
    hashFunc(
      g0.exponentiate(proof.d).operate(y0.exponentiate(proof.c)).value,
      g1.exponentiate(proof.d).operate(y1.exponentiate(proof.c)).value
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
  verifyProofEqualDiscreteLogs,
};
