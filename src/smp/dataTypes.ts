/**
 * Data types used in SMP protocol in OTR.
 * Ref: https://github.com/otrv4/otrv4/blob/master/otrv4.md#data-types
 */

import BN from "bn.js";

import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";
import { ECPoint } from "./config";
import { babyJub } from "circomlib";
import { concatUint8Array, bigIntToNumber } from "./utils";
import { NotImplemented, ValueError } from "./exceptions";

type TEndian = typeof BIG_ENDIAN | typeof LITTLE_ENDIAN;

/**
 * Base class for types that can be {de}serialized.
 *
 * NOTE: `NotImplemented` is used as a workaround that typescript doesn't support `abstract static`
 *  type.
 */
abstract class BaseSerializable {
  /**
   * Parse the value from its binary representation.
   */
  static deserialize(_: Uint8Array): BaseSerializable {
    throw new NotImplemented(); // Make tsc happy
  }
  /**
   * Return the value's binary representation.
   */
  abstract serialize(): Uint8Array;
}

/**
 * Base class for fixed-size integers.
 *
 * NOTE: `NotImplemented` is used as a workaround that typescript doesn't support `abstract static`
 *  type.
 */
class BaseFixedInt extends BaseSerializable {
  /** Number of bytes the integer occupies. */
  static size: number;
  value: BigInt;

  constructor(value: number | BigInt) {
    super();
    if (typeof value === "number") {
      this.value = BigInt(value);
    } else if (typeof value === "bigint") {
      this.value = value;
    } else {
      throw new ValueError("typeof value should only be number or bigint");
    }
  }
  static deserialize(_: Uint8Array): BaseFixedInt {
    throw new NotImplemented(); // Make tsc happy
  }
  serialize(): Uint8Array {
    throw new NotImplemented(); // Make tsc happy
  }
}

/**
 * Serialize `value` to its binary representation. [[BN]] is to perform [de]serialization.
 *
 * @param value - The integer to be serialized.
 * @param size - Number of bytes the binary representation should occupy.
 * @param endian - Endian the binary representation should follow.
 */
function numberToUint8Array(
  value: BigInt,
  endian: TEndian,
  size?: number
): Uint8Array {
  return new Uint8Array(new BN(value.toString()).toArray(endian, size));
}

/**
 * Parse a number from its binary representation. [[BN]] is to perform [de]serialization.
 */
function uint8ArrayToNumber(a: Uint8Array, endian: TEndian): BigInt {
  return BigInt(new BN(a, undefined, endian).toString());
}

/**
 * Create a `BaseFixedInt` class which occupies `size` bytes.
 */
function createFixedIntClass(
  size: number,
  endian: TEndian
): typeof BaseFixedInt {
  class FixedIntClass extends BaseFixedInt {
    static size: number = size;

    constructor(readonly value: BigInt) {
      super(value);
      const maxValue = BigInt(2) ** BigInt(size * 8) - BigInt(1);
      if (BigInt(value) < 0 || value > maxValue) {
        throw new ValueError(`value should be non-negative: value=${value}`);
      }
    }

    static deserialize(bytes: Uint8Array): FixedIntClass {
      if (bytes.length !== size) {
        throw new ValueError(`length of ${bytes} should be ${size}`);
      }
      return new FixedIntClass(uint8ArrayToNumber(bytes, endian));
    }

    serialize(): Uint8Array {
      return numberToUint8Array(BigInt(this.value), endian, size);
    }
  }
  return FixedIntClass;
}

/**
 * Bytes (BYTE):
 *  1 byte unsigned value
 */
const Byte = createFixedIntClass(1, BIG_ENDIAN);

/**
 * Shorts (SHORT):
 *  2 byte unsigned value, big-endian
 */
const Short = createFixedIntClass(2, BIG_ENDIAN);

/**
 * Ints (INT):
 *  4 byte unsigned value, big-endian
 */
const Int = createFixedIntClass(4, BIG_ENDIAN);

/**
 * Multi-precision integers (MPI):
 *  4 byte unsigned len, big-endian
 *  len byte unsigned value, big-endian
 *  (MPIs must use the minimum-length encoding; i.e. no leading 0x00 bytes.
 *  This is important when calculating public key fingerprints.)
 */
class MPI implements BaseSerializable {
  static lengthSize: number = 4;

  constructor(readonly value: BigInt) {
    if (BigInt(value) < 0) {
      throw new ValueError("expect non-negative value");
    }
  }

  serialize(): Uint8Array {
    const bytes = numberToUint8Array(this.value, BIG_ENDIAN);
    const lenBytes = numberToUint8Array(
      BigInt(bytes.length),
      BIG_ENDIAN,
      MPI.lengthSize
    );
    return concatUint8Array(lenBytes, bytes);
  }

  /**
   * Parse a `MPI` from `bytes` and return the rest of the bytes. It's useful when we are
   *  deserializing a list of `MPI`s in a serial binary representation.
   *
   * @param bytes - The binary representation containing a `MPI`.
   */
  static consume(bytes: Uint8Array): [MPI, Uint8Array] {
    // It's safe because `bytes.length <= 2**48 - 1`.
    const len = bigIntToNumber(
      uint8ArrayToNumber(bytes.slice(0, this.lengthSize), BIG_ENDIAN)
    );
    if (bytes.length - this.lengthSize < len) {
      throw new ValueError("`bytes` is not long enough for `len`");
    }
    const value = BigInt(
      new BN(bytes.slice(this.lengthSize, this.lengthSize + len)).toString()
    );
    return [new MPI(value), bytes.slice(this.lengthSize + len)];
  }

  static deserialize(bytes: Uint8Array): MPI {
    const [mpi, bytesRemaining] = this.consume(bytes);
    if (bytesRemaining.length !== 0) {
      throw new ValueError(
        `bytes=${bytes} contains redundant bytes: bytesRemaining=${bytesRemaining}`
      );
    }
    return mpi;
  }
}

/**
 * Scalar (INT):
 *  32 byte unsigned value, little-endian
 *  NOTE: It's different from OTRv4 since we're using baby jubjub curve, where scalar size is at most 32
 *    bytes.
 */
const Scalar = createFixedIntClass(32, LITTLE_ENDIAN);

/**
 * Point (POINT):
 *  32 byte, little-edian
 *  NOTE: It's different from OTRv4 since we're using baby jubjub curve, where the field size is 32 bytes.
 */

class Point extends BaseSerializable {
  static size: number = 32;

  constructor(readonly point: ECPoint) {
    super();
  }

  static deserialize(bytes: Uint8Array): Point {
    if (bytes.length !== Point.size) {
      throw new ValueError(`length of ${bytes} should be ${Point.size}`);
    }
    return new Point(babyJub.unpackPoint(bytes) as ECPoint);
  }

  serialize(): Uint8Array {
    const res = new Uint8Array(babyJub.packPoint(this.point) as Buffer);
    if (res.length !== Point.size) {
      throw new ValueError(
        `length of \`res\` should be ${Point.size}: length=${res}`
      );
    }
    return res;
  }
}

export { BaseSerializable, BaseFixedInt, Byte, Short, Int, MPI, Scalar, Point };
