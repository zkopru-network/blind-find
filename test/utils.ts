import { babyJubPointFactory, secretFactory } from "../src/smp/v4/factories";
import { BabyJubPoint } from "../src/smp/v4/babyJub";
import { genPrivKey, genPubKey, PubKey } from "maci-crypto";

const NUM_RETRIES = 100;

export function factoryExclude<T>(
  toBeExcluded: T[],
  factory: () => T,
  compareFunc: (a: T, b: T) => boolean,
  numRetries?: number
): T {
  if (numRetries === undefined) {
    numRetries = NUM_RETRIES;
  }
  for (let i = 0; i < numRetries; i++) {
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

export function babyJubPointFactoryExclude(
  toBeExcluded: BabyJubPoint[],
  numRetries?: number
): BabyJubPoint {
  return factoryExclude<BabyJubPoint>(
    toBeExcluded,
    babyJubPointFactory,
    (a: BabyJubPoint, b: BabyJubPoint) => a.equal(b),
    numRetries
  );
}

export function bigIntFactoryExclude(
  toBeExcluded: BigInt[],
  numRetries?: number
): BigInt {
  return factoryExclude<BigInt>(
    toBeExcluded,
    secretFactory,
    (a: BigInt, b: BigInt) => a === b,
    numRetries
  );
}

export function privkeyFactoryExclude(
  toBeExcluded: BigInt[],
  numRetries?: number
): BigInt {
  return factoryExclude<BigInt>(
    toBeExcluded,
    genPrivKey,
    (a: BigInt, b: BigInt) => a === b,
    numRetries
  );
}

export function pubkeyFactoryExclude(
  toBeExcluded: PubKey[],
  numRetries?: number
): PubKey {
  return factoryExclude<PubKey>(
    toBeExcluded,
    () => genPubKey(genPrivKey()),
    (a: PubKey, b: PubKey) => a[0] === b[0] && a[1] === b[1],
    numRetries
  );
}

export const deepcopyRawObj = (obj: any) => {
  return JSON.parse(JSON.stringify(obj));
};
