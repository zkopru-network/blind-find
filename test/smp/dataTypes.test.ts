import BN from 'bn.js';

import { concatUint8Array } from '../../src/smp/utils';
import { Byte, Short, Int, MPI } from '../../src/smp/dataTypes';
import { ValueError } from '../../src/smp/exceptions';

describe('Fixed types', () => {
  const types = [Byte, Short, Int];
  test('succeeds', () => {
    const expectedSize = [1, 2, 4];
    const expectedValue = [255, 255, 255];
    const expectedSerialized = [
      new Uint8Array([255]),
      new Uint8Array([0, 255]),
      new Uint8Array([0, 0, 0, 255]),
    ];
    for (const index in types) {
      const Type = types[index];
      const b = new Type(expectedValue[index]);
      expect(Type.size).toEqual(expectedSize[index]);
      expect(b.value).toEqual(expectedValue[index]);
      expect(b.serialize()).toEqual(expectedSerialized[index]);
      expect(b.value).toEqual(
        Type.deserialize(expectedSerialized[index]).value
      );
    }
  });
  test('constructor fails', () => {
    // Too large
    for (const index in types) {
      const Type = types[index];
      expect(() => {
        new Type(2 ** (Type.size * 8));
      }).toThrowError(ValueError);
    }
    // Negative
    for (const Type of types) {
      expect(() => {
        new Type(-1);
      }).toThrowError(ValueError);
    }
  });
});

describe('MPI(variable-length integer)', () => {
  test('succeeds', () => {
    const values = [
      new BN(0),
      new BN(256),
      new BN(2).pow(new BN(64)).subn(1), // 2**64 - 1
    ];
    const expectedSerialized = [
      new Uint8Array([0, 0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 2, 1, 0]),
      new Uint8Array([0, 0, 0, 8, 255, 255, 255, 255, 255, 255, 255, 255]),
    ];
    for (const index in values) {
      const mpi = new MPI(values[index]);
      const expected = expectedSerialized[index];
      expect(mpi.serialize()).toEqual(expected);
      expect(MPI.deserialize(expected).value.eq(mpi.value));
    }
  });
  test('consume', () => {
    const bytes = concatUint8Array(
      new Uint8Array([0, 0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 2, 1, 0])
    );
    const [mpi1, bytesRemaining] = MPI.consume(bytes);
    expect(mpi1.value.eqn(0)).toBeTruthy();
    const [mpi2, bytesRemaining2] = MPI.consume(bytesRemaining);
    expect(mpi2.value.eqn(256)).toBeTruthy();
    expect(() => {
      MPI.consume(bytesRemaining2);
    }).toThrowError(ValueError);
    // We can consume only the prefix, i.e. [0, 0, 0, 1, 1].
    const b = new Uint8Array([0, 0, 0, 1, 1, 1]);
    const [mpi3, bRemaining] = MPI.consume(b);
    expect(() => {
      expect(mpi3.value.eqn(1)).toBeTruthy();
      expect(bRemaining).toEqual(new Uint8Array([1]));
    });
  });
  test('constructor fails', () => {
    // Negative
    expect(() => {
      new MPI(new BN(-1));
    }).toThrowError(ValueError);
  });
  test('deserialize fails', () => {
    // Empty
    expect(() => {
      MPI.deserialize(new Uint8Array([]));
    }).toThrowError(ValueError);
    // Length too short
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 1, 1, 1]));
    }).toThrowError(ValueError);
    // Length too long
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 2, 0]));
    }).toThrowError(ValueError);
  });
});
