/**
 * Data types used in SMP protocol in OTR.
 * Ref: https://github.com/otrv4/otrv4/blob/master/otrv4.md#data-types
 */

import { BIG_ENDIAN } from "./constants";
import { NotImplemented, ValueError } from "./exceptions";
import { TEndian } from "./types";
import {
  concatUint8Array,
  bigIntToNumber,
  uint8ArrayToBigInt,
  bigIntToUint8Array
} from "./utils";

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
  static deserialize(b: Uint8Array): BaseSerializable {
    const [req, bytesRemaining] = this.consume(b);
    if (bytesRemaining.length !== 0) {
      throw new ValueError(`b should contain only this message: b=${b}`);
    }
    return req;
  }

  static consume(_: Uint8Array): [BaseSerializable, Uint8Array] {
    throw new NotImplemented();
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
    this.value = BigInt(value);
  }

  static deserialize(_: Uint8Array): BaseFixedInt {
    throw new NotImplemented(); // Make tsc happy
  }
  static consume(_: Uint8Array): [BaseFixedInt, Uint8Array] {
    throw new NotImplemented();
  }
  serialize(): Uint8Array {
    throw new NotImplemented(); // Make tsc happy
  }
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

    constructor(value: number | BigInt) {
      super(value);
      const maxValue = BigInt(2) ** BigInt(size * 8) - BigInt(1);
      if (this.value < BigInt(0) || this.value > maxValue) {
        throw new ValueError(`value should be non-negative: value=${value}`);
      }
    }

    static deserialize(bytes: Uint8Array): FixedIntClass {
      if (bytes.length !== size) {
        throw new ValueError(`length of ${bytes} should be ${size}`);
      }
      return new FixedIntClass(uint8ArrayToBigInt(bytes, endian));
    }

    static consume(bytes: Uint8Array): [FixedIntClass, Uint8Array] {
      const res = this.deserialize(bytes.slice(0, this.size));
      return [res, bytes.slice(this.size)];
    }

    serialize(): Uint8Array {
      return bigIntToUint8Array(BigInt(this.value), endian, size);
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
    const bytes = bigIntToUint8Array(this.value, BIG_ENDIAN);
    const lenBytes = bigIntToUint8Array(
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
      uint8ArrayToBigInt(bytes.slice(0, this.lengthSize), BIG_ENDIAN)
    );
    if (bytes.length - this.lengthSize < len) {
      throw new ValueError("`bytes` is not long enough for `len`");
    }
    const value = uint8ArrayToBigInt(
      bytes.slice(this.lengthSize, this.lengthSize + len),
      BIG_ENDIAN
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
 * `TLV` stands for "Type, Length, and Value", literally it's the wire format.
 * A `TLV` record consist of the fields:
 *  Type: `Short`
 *    The type of this record. Records with unrecognized types should be ignored.
 *  Length: `Short`
 *    The length of the following field
 *  Value: `Byte[]` with length `len`(where len is the value of the Length field)
 *    Any pertinent data for the record type.
 */
class TLV extends BaseSerializable {
  // No need to store `length` since it is implied in `value`.
  constructor(readonly type: BaseFixedInt, readonly value: Uint8Array) {
    super();
  }

  static deserialize(bytes: Uint8Array): TLV {
    const [tlv] = this.consume(bytes);
    return tlv;
  }

  static consume(bytes: Uint8Array): [TLV, Uint8Array] {
    const typeSize = Short.size;
    const lengthSize = Short.size;
    const type = Short.deserialize(bytes.slice(0, typeSize));
    const length = Short.deserialize(
      bytes.slice(typeSize, typeSize + lengthSize)
    );
    const expectedTLVTotalSize = bigIntToNumber(
      BigInt(typeSize) + BigInt(lengthSize) + BigInt(length.value)
    );
    if (bytes.length < expectedTLVTotalSize) {
      throw new ValueError("`bytes` is not long enough");
    }
    const value = bytes.slice(typeSize + lengthSize, expectedTLVTotalSize);
    return [new TLV(type, value), bytes.slice(expectedTLVTotalSize)];
  }

  serialize(): Uint8Array {
    const typeBytes = this.type.serialize();
    const lengthBytes = new Short(this.value.length).serialize();
    const valueBytes = this.value;
    return concatUint8Array(
      concatUint8Array(typeBytes, lengthBytes),
      valueBytes
    );
  }
}

export {
  BaseSerializable,
  BaseFixedInt,
  createFixedIntClass,
  Byte,
  Short,
  Int,
  MPI,
  TLV
};
