import BN from "bn.js";
import { BabyJubPoint } from "./babyJub";
import { ValueError } from "./exceptions";
import { q } from "./config";
import { Point } from "./dataTypes";

/**
 * Concatenate two `Uint8Array` into one.
 */
export const concatUint8Array = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  let c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
};

/**
 * Modular operation for `BigInt`.
 * @param a Number to be reduced
 * @param modulus Modulus
 */
export const bigIntMod = (a: BigInt, modulus: BigInt): BigInt => {
  return BigInt(
    new BN(a.toString()).umod(new BN(modulus.toString())).toString()
  );
};

/**
 * Safely cast a `BigInt` to `Number`.
 * @param a Number to be cast.
 */
export const bigIntToNumber = (a: BigInt): number => {
  if (
    a > BigInt(Number.MAX_SAFE_INTEGER) ||
    a < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new ValueError(
      "unsafe to cast the integer because it's out of range of `Number`"
    );
  }
  return Number(a);
};

export const babyJubPointToScalar = (a: BabyJubPoint): BigInt => {
  return bigIntMod(
    BigInt(new BN(new Point(a.point).serialize()).toString()),
    q
  );
};
