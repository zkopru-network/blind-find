/**
 * Data types used in SMP protocol in OTR.
 * Ref: https://otr.cypherpunks.ca/Protocol-v3-4.1.1.html
 */
import { MultiplicativeGroup } from './multiplicativeGroup';
import { ENDIAN } from './constants';
import BN from 'bn.js';

import { concatUint8Array } from './utils';
import { NotImplemented, ValueError } from './exceptions';

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

  constructor(readonly value: number) {
    super();
  }
  static deserialize(_: Uint8Array): BaseFixedInt {
    throw new NotImplemented(); // Make tsc happy
  }
  serialize(): Uint8Array {
    throw new NotImplemented(); // Make tsc happy
  }
}

/**
 * Serialize `value` to its binary representation.
 *
 * @param value - The integer to be serialized.
 * @param size - Number of bytes the binary representation should occupy.
 */
function numberToUint8Array(value: number, size?: number): Uint8Array {
  return new Uint8Array(new BN(value).toArray(ENDIAN, size));
}

/**
 * Parse a number from its binary representation.
 */
function uint8ArrayToNumber(a: Uint8Array): number {
  // The max value of `number` type is `2**53 - 1`.
  // We roughly set the max length as `6`, where the maximum value is `2**48 - 1`.
  if (a.length > 6) {
    throw new ValueError('the binary value is too large for a `number`');
  }
  return new BN(a).toNumber();
}

/**
 * Create a `BaseFixedInt` class which occupies `size` bytes.
 */
function createFixedIntClass(size: number): typeof BaseFixedInt {
  class FixedIntClass extends BaseFixedInt {
    static size: number = size;

    constructor(readonly value: number) {
      super(value);
      if (value < 0 || value > 2 ** (size * 8) - 1) {
        throw new ValueError(
          `invalid value: value=${value}, maximum=${2 ** (size * 8) - 1}`
        );
      }
    }

    static deserialize(bytes: Uint8Array): FixedIntClass {
      if (bytes.length !== size) {
        throw new ValueError(`length of ${bytes} should be ${size}`);
      }
      return new FixedIntClass(uint8ArrayToNumber(bytes));
    }

    serialize(): Uint8Array {
      return numberToUint8Array(this.value, size);
    }
  }
  return FixedIntClass;
}

/**
 * Bytes (BYTE):
 *  1 byte unsigned value
 */
const Byte = createFixedIntClass(1);

/**
 * Shorts (SHORT):
 *  2 byte unsigned value, big-endian
 */
const Short = createFixedIntClass(2);

/**
 * Ints (INT):
 *  4 byte unsigned value, big-endian
 */
const Int = createFixedIntClass(4);

/**
 * Multi-precision integers (MPI):
 *  4 byte unsigned len, big-endian
 *  len byte unsigned value, big-endian
 *  (MPIs must use the minimum-length encoding; i.e. no leading 0x00 bytes.
 *  This is important when calculating public key fingerprints.)
 */
class MPI implements BaseSerializable {
  static lengthSize: number = 4;

  constructor(readonly value: BN) {
    if (value.isNeg()) {
      throw new ValueError('expect non-negative value');
    }
  }

  serialize(): Uint8Array {
    const bytes = new Uint8Array(this.value.toArray(ENDIAN));
    const lenBytes = numberToUint8Array(bytes.length, MPI.lengthSize);
    return concatUint8Array(lenBytes, bytes);
  }

  /**
   * Parse a `MPI` from `bytes` and return the rest of the bytes. It's useful when we are
   *  deserializing a list of `MPI`s in a serial binary representation.
   *
   * @param bytes - The binary representation containing a `MPI`.
   */
  static consume(bytes: Uint8Array): [MPI, Uint8Array] {
    const len = uint8ArrayToNumber(bytes.slice(0, this.lengthSize));
    if (bytes.length < this.lengthSize + len) {
      throw new ValueError('`bytes` does not long enough for `len`');
    }
    const value = new BN(bytes.slice(this.lengthSize, this.lengthSize + len));
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

  /**
   * Initialize a `MPI` instance from a multiplicative group element.
   *
   * @param g - A Multiplicative group element.
   */
  static fromMultiplicativeGroup(g: MultiplicativeGroup): MPI {
    return new MPI(g.value);
  }
}

export { BaseSerializable, BaseFixedInt, Byte, Short, Int, MPI };
