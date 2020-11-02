import { babyJubPointFactory } from "../src/smp/v4/factories";
import { BabyJubPoint } from "../src/smp/v4/babyJub";

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
