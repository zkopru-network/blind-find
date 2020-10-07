import BN from 'bn.js';

import { MultiplicativeGroup } from './multiplicativeGroup';
import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
} from './proofs';

import { BaseFixedInt, BaseSerializable, Short, Int, MPI } from './dataTypes';

import { concatUint8Array } from './utils';
import { NotImplemented, ValueError } from './exceptions';

/**
 * `TLV` stands for "Type, Length, and Value", literally its wire format.
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
    const typeSize = Short.size;
    const lengthSize = Short.size;
    const type = Short.deserialize(bytes.slice(0, typeSize));
    const length = Short.deserialize(
      bytes.slice(typeSize, typeSize + lengthSize)
    );
    const expectedTLVTotalSize = typeSize + lengthSize + length.value;
    if (bytes.length < expectedTLVTotalSize) {
      throw new ValueError('`bytes` does not long enough');
    }
    const value = bytes.slice(typeSize + lengthSize, expectedTLVTotalSize);
    return new TLV(type, value);
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

/** TLV types */
/**
 * Type 2: SMP Message 1
 *  The value represents an initiating message of the Socialist Millionaires' Protocol.
 */
const TLVTypeSMPMessage1 = new Short(2);
/**
 * Type 3: SMP Message 2
 *  The value represents the second message in an instance of SMP.
 */
const TLVTypeSMPMessage2 = new Short(3);
/**
 * Type 4: SMP Message 3
 *  The value represents the third message in an instance of SMP.
 */
const TLVTypeSMPMessage3 = new Short(4);
/**
 * Type 5: SMP Message 4
 *  The value represents the final message in an instance of SMP.
 */
const TLVTypeSMPMessage4 = new Short(5);

/**
 * TODO: Consider extending from `TLV`.
 * SMP Message TLVs (types 2-5) all carry data sharing the same general format:
 *  MPI count (INT)
 *    The number of MPIs contained in the remainder of the TLV.
 *  MPI 1 (MPI)
 *    The first MPI of the TLV, serialized into a byte array.
 *  MPI 2 (MPI)
 *    The second MPI of the TLV, serialized into a byte array.
 *  ,...etc.
 */
abstract class BaseSMPMessage {
  abstract wireValues: (BN | MultiplicativeGroup)[];

  static tlvToMPIs(
    type: BaseFixedInt,
    expectedLength: number,
    tlv: TLV
  ): MPI[] {
    if (type.value !== tlv.type.value) {
      throw new ValueError(
        `type mismatch: type.value=${type.value}, tlv.type.value=${tlv.type.value}`
      );
    }
    let bytes = tlv.value;
    const mpiCount = Int.deserialize(bytes.slice(0, Int.size));
    let bytesRemaining = bytes.slice(Int.size);
    const mpis: MPI[] = [];
    let mpi: MPI;
    for (let i = 0; i < mpiCount.value; i++) {
      [mpi, bytesRemaining] = MPI.consume(bytesRemaining);
      mpis.push(mpi);
    }
    if (expectedLength !== mpis.length) {
      throw new ValueError(
        `length of tlv=${tlv} mismatches: expectedLength=${expectedLength}`
      );
    }
    return mpis;
  }

  mpisToTLV(
    type: BaseFixedInt,
    ...elements: (BN | MultiplicativeGroup)[]
  ): TLV {
    const length = new Int(elements.length);
    let res = length.serialize();
    for (const element of elements) {
      let mpi: MPI;
      if (element instanceof BN) {
        mpi = new MPI(element);
      } else {
        mpi = MPI.fromMultiplicativeGroup(element);
      }
      res = concatUint8Array(res, mpi.serialize());
    }
    return new TLV(type, res);
  }

  // abstract methods
  static fromTLV(_: TLV, __: BN): BaseSMPMessage {
    throw new NotImplemented();
  }
  abstract toTLV(): TLV;
}

/**
 * SMP message 1 is sent by Alice to begin a DH exchange to determine two new generators, g2 and g3.
 * It contains the following mpi values:
 *  g2a
 *    Alice's half of the DH exchange to determine g2.
 *  c2, D2
 *    A zero-knowledge proof that Alice knows the exponent associated with her transmitted value
 *    g2a.
 *  g3a
 *    Alice's half of the DH exchange to determine g3.
 *  c3, D3
 *    A zero-knowledge proof that Alice knows the exponent associated with her transmitted value
 *    g3a.
 */
class SMPMessage1 extends BaseSMPMessage {
  wireValues: [MultiplicativeGroup, BN, BN, MultiplicativeGroup, BN, BN];

  constructor(
    readonly g2a: MultiplicativeGroup,
    readonly g2aProof: ProofDiscreteLog,
    readonly g3a: MultiplicativeGroup,
    readonly g3aProof: ProofDiscreteLog
  ) {
    super();
    this.wireValues = [
      g2a,
      g2aProof.c,
      g2aProof.d,
      g3a,
      g3aProof.c,
      g3aProof.d,
    ];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage1 {
    const mpis = this.tlvToMPIs(TLVTypeSMPMessage1, 6, tlv);
    return new SMPMessage1(
      new MultiplicativeGroup(groupOrder, mpis[0].value),
      { c: mpis[1].value, d: mpis[2].value },
      new MultiplicativeGroup(groupOrder, mpis[3].value),
      { c: mpis[4].value, d: mpis[5].value }
    );
  }

  toTLV(): TLV {
    return this.mpisToTLV(TLVTypeSMPMessage1, ...this.wireValues);
  }
}

/**
 * SMP message 2 is sent by Bob to complete the DH exchange to determine the new generators,
 * g2 and g3. It also begins the construction of the values used in the final comparison of
 * the protocol. It contains the following mpi values:
 *  g2b
 *    Bob's half of the DH exchange to determine g2.
 *  c2, D2
 *    A zero-knowledge proof that Bob knows the exponent associated with his transmitted value g2b.
 *  g3b
 *    Bob's half of the DH exchange to determine g3.
 *  c3, D3
 *    A zero-knowledge proof that Bob knows the exponent associated with his transmitted value g3b.
 *  Pb, Qb
 *    These values are used in the final comparison to determine if Alice and Bob share the
 *    same secret.
 *  cP, D5, D6
 *    A zero-knowledge proof that Pb and Qb were created according to the protcol given above.
 */
class SMPMessage2 extends BaseSMPMessage {
  wireValues: [
    MultiplicativeGroup,
    BN,
    BN,
    MultiplicativeGroup,
    BN,
    BN,
    MultiplicativeGroup,
    MultiplicativeGroup,
    BN,
    BN,
    BN
  ];

  constructor(
    readonly g2b: MultiplicativeGroup,
    readonly g2bProof: ProofDiscreteLog,
    readonly g3b: MultiplicativeGroup,
    readonly g3bProof: ProofDiscreteLog,
    readonly pb: MultiplicativeGroup,
    readonly qb: MultiplicativeGroup,
    readonly pbqbProof: ProofEqualDiscreteCoordinates
  ) {
    super();
    this.wireValues = [
      g2b,
      g2bProof.c,
      g2bProof.d,
      g3b,
      g3bProof.c,
      g3bProof.d,
      pb,
      qb,
      pbqbProof.c,
      pbqbProof.d0,
      pbqbProof.d1,
    ];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage2 {
    const mpis = this.tlvToMPIs(TLVTypeSMPMessage2, 11, tlv);
    return new SMPMessage2(
      new MultiplicativeGroup(groupOrder, mpis[0].value),
      { c: mpis[1].value, d: mpis[2].value },
      new MultiplicativeGroup(groupOrder, mpis[3].value),
      { c: mpis[4].value, d: mpis[5].value },
      new MultiplicativeGroup(groupOrder, mpis[6].value),
      new MultiplicativeGroup(groupOrder, mpis[7].value),
      { c: mpis[8].value, d0: mpis[9].value, d1: mpis[10].value }
    );
  }

  toTLV(): TLV {
    return this.mpisToTLV(TLVTypeSMPMessage2, ...this.wireValues);
  }
}

/**
 * SMP message 3 is Alice's final message in the SMP exchange. It has the last of the information
 * required by Bob to determine if x = y. It contains the following mpi values:
 *  Pa, Qa
 *    These values are used in the final comparison to determine if Alice and Bob share the
 *    same secret.
 *  cP, D5, D6
 *    A zero-knowledge proof that Pa and Qa were created according to the protcol given above.
 *  Ra
 *    This value is used in the final comparison to determine if Alice and Bob share
 *    the same secret.
 *  cR, D7
 *    A zero-knowledge proof that Ra was created according to the protcol given above.
 */
class SMPMessage3 extends BaseSMPMessage {
  wireValues: [
    MultiplicativeGroup,
    MultiplicativeGroup,
    BN,
    BN,
    BN,
    MultiplicativeGroup,
    BN,
    BN
  ];

  constructor(
    readonly pa: MultiplicativeGroup,
    readonly qa: MultiplicativeGroup,
    readonly paqaProof: ProofEqualDiscreteCoordinates,
    readonly ra: MultiplicativeGroup,
    readonly raProof: ProofEqualDiscreteLogs
  ) {
    super();
    this.wireValues = [
      pa,
      qa,
      paqaProof.c,
      paqaProof.d0,
      paqaProof.d1,
      ra,
      raProof.c,
      raProof.d,
    ];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage3 {
    const mpis = this.tlvToMPIs(TLVTypeSMPMessage3, 8, tlv);
    return new SMPMessage3(
      new MultiplicativeGroup(groupOrder, mpis[0].value),
      new MultiplicativeGroup(groupOrder, mpis[1].value),
      { c: mpis[2].value, d0: mpis[3].value, d1: mpis[4].value },
      new MultiplicativeGroup(groupOrder, mpis[5].value),
      { c: mpis[6].value, d: mpis[7].value }
    );
  }

  toTLV(): TLV {
    return this.mpisToTLV(TLVTypeSMPMessage3, ...this.wireValues);
  }
}

/**
 * SMP message 4 is Bob's final message in the SMP exchange. It has the last of the information
 * required by Alice to determine if x = y. It contains the following mpi values:
 *  Rb
 *    This value is used in the final comparison to determine if Alice and Bob share the
 *    same secret.
 *  cR, D7
 *    A zero-knowledge proof that Rb was created according to the protcol given above.
 */
class SMPMessage4 extends BaseSMPMessage {
  wireValues: [MultiplicativeGroup, BN, BN];
  constructor(
    readonly rb: MultiplicativeGroup,
    readonly rbProof: ProofEqualDiscreteLogs
  ) {
    super();
    this.wireValues = [rb, rbProof.c, rbProof.d];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage4 {
    const mpis = this.tlvToMPIs(TLVTypeSMPMessage4, 3, tlv);
    return new SMPMessage4(new MultiplicativeGroup(groupOrder, mpis[0].value), {
      c: mpis[1].value,
      d: mpis[2].value,
    });
  }

  toTLV(): TLV {
    return this.mpisToTLV(TLVTypeSMPMessage4, ...this.wireValues);
  }
}

export {
  BaseSMPMessage,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
  TLV,
};
