import { babyJubPointFactory, secretFactory } from "../src/smp/v4/factories";
import { BabyJubPoint } from "../src/smp/v4/babyJub";
import { genPrivKey } from "maci-crypto";

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

export const deepcopyRawObj = (obj: any) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * AsyncEvent allows set/wait in async code. WARNING: Not sure if it's safe between coroutines.
 */
export class AsyncEvent {
  private isSet: boolean;
  private isWaited: boolean;
  private eventSetter?: (value?: any) => void;
  private eventWaiter: Promise<void>;

  constructor() {
    this.eventWaiter = new Promise<void>((res, _) => {
      this.eventSetter = res;
    });
    this.isSet = false;
    this.isWaited = false;
  }

  set() {
    if (this.isSet) {
      return;
    }
    this.isSet = true;
    if (this.eventSetter === undefined) {
      throw new Error(
        "eventSetter is undefined, i.e. set is called before wait is called"
      );
    }
    this.eventSetter();
  }

  async wait() {
    if (this.isSet) {
      throw new Error("waiting for a set event");
    }
    if (this.isWaited) {
      throw new Error("waiting for a waited event");
    }
    this.isWaited = true;
    await this.eventWaiter;
  }
}
