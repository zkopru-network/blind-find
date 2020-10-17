import { BabyJubPoint } from './babyJub';

import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs
} from "./proofs";

import { BaseFixedInt, BaseSerializable, Short, Scalar, Point } from "./dataTypes";

import { concatUint8Array, bigIntToNumber } from "./utils";
import { NotImplemented, ValueError } from "./exceptions";

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
    const typeSize = Short.size;
    const lengthSize = Short.size;
    const type = Short.deserialize(bytes.slice(0, typeSize));
    const length = Short.deserialize(
      bytes.slice(typeSize, typeSize + lengthSize)
    );
    const expectedTLVTotalSize = bigIntToNumber(BigInt(typeSize) + BigInt(lengthSize) + BigInt(length.value));
    if (bytes.length < expectedTLVTotalSize) {
      throw new ValueError("`bytes` is not long enough");
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

/**
 * TODO: Consider extending from `TLV`.
 * SMP Message TLVs (types 2-5) carry two possible types: `Scalar` and `Point`.
 */

type SMPMessageElement = BigInt | BabyJubPoint;
type SMPMessageElementList = SMPMessageElement[];
type WireTypes = (typeof BigInt | typeof BabyJubPoint)[];

abstract class BaseSMPMessage {
  static wireTypes: WireTypes;
  static tlvType: BaseFixedInt;

  static fromTLVToElements(expectedMsgType: BaseFixedInt, tlv: TLV): SMPMessageElementList {
    if (expectedMsgType.value !== tlv.type.value) {
      throw new ValueError(
        `type mismatch: type.value=${expectedMsgType.value}, tlv.type.value=${tlv.type.value}`
      );
    }
    let bytes = tlv.value;
    const res: SMPMessageElementList = [];
    for (const t of this.wireTypes) {
      let value: SMPMessageElement;
      if (t === BigInt) {
        value = Scalar.deserialize(bytes.slice(0, Scalar.size)).value;
        bytes = bytes.slice(Scalar.size);
      } else {
        value = new BabyJubPoint(Point.deserialize(bytes.slice(0, Point.size)).point);
        bytes = bytes.slice(Point.size);
      }
      res.push(value);
    }
    return res;
  }

  static fromElementsToTLV(
    msgType: BaseFixedInt,
    elements: SMPMessageElementList
  ): TLV {
    if (elements.length !== this.wireTypes.length) {
      throw new ValueError('length mismatch between elements and wireTypes');
    }
    let res = new Uint8Array([]);
    for (const index in this.wireTypes) {
      let valueBytes: Uint8Array;
      const t = this.wireTypes[index];
      const element = elements[index];
      if (t === BigInt) {
        valueBytes = new Scalar(element as BigInt).serialize();
      } else {
        valueBytes = new Point((element as BabyJubPoint).point).serialize();
      }
      res = concatUint8Array(res, valueBytes);
    }
    return new TLV(msgType, res);
  }

  // abstract methods
  static fromTLV(_: TLV): BaseSMPMessage {
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
  static wireTypes = [BabyJubPoint, BigInt, BigInt, BabyJubPoint, BigInt, BigInt];
  static tlvType = new Short(2);

  constructor(
    readonly g2a: BabyJubPoint,
    readonly g2aProof: ProofDiscreteLog,
    readonly g3a: BabyJubPoint,
    readonly g3aProof: ProofDiscreteLog
  ) {
    super();
  }

  static fromTLV(tlv: TLV): SMPMessage1 {
    const elements = this.fromTLVToElements(this.tlvType, tlv);
    return new SMPMessage1(
      elements[0] as BabyJubPoint,
      { c: elements[1] as BigInt, d: elements[2] as BigInt },
      elements[3] as BabyJubPoint,
      { c: elements[4] as BigInt, d: elements[5] as BigInt }
    );
  }

  toTLV(): TLV {
    return SMPMessage1.fromElementsToTLV(
      SMPMessage1.tlvType,
      [ this.g2a, this.g2aProof.c, this.g2aProof.d, this.g3a, this.g3aProof.c, this.g3aProof.d],
    );
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
  static wireTypes = [
    BabyJubPoint,
    BigInt,
    BigInt,
    BabyJubPoint,
    BigInt,
    BigInt,
    BabyJubPoint,
    BabyJubPoint,
    BigInt,
    BigInt,
    BigInt
  ];
  static tlvType = new Short(3);

  constructor(
    readonly g2b: BabyJubPoint,
    readonly g2bProof: ProofDiscreteLog,
    readonly g3b: BabyJubPoint,
    readonly g3bProof: ProofDiscreteLog,
    readonly pb: BabyJubPoint,
    readonly qb: BabyJubPoint,
    readonly pbqbProof: ProofEqualDiscreteCoordinates
  ) {
    super();
  }

  static fromTLV(tlv: TLV): SMPMessage2 {
    const elements = this.fromTLVToElements(this.tlvType, tlv);
    return new SMPMessage2(
      elements[0] as BabyJubPoint,
      { c: elements[1] as BigInt, d: elements[2] as BigInt },
      elements[3] as BabyJubPoint,
      { c: elements[4] as BigInt, d: elements[5] as BigInt },
      elements[6] as BabyJubPoint,
      elements[7] as BabyJubPoint,
      { c: elements[8] as BigInt, d0: elements[9] as BigInt, d1: elements[10] as BigInt },
    );
  }

  toTLV(): TLV {
    return SMPMessage2.fromElementsToTLV(
      SMPMessage2.tlvType,
      [ this.g2b, this.g2bProof.c, this.g2bProof.d, this.g3b, this.g3bProof.c, this.g3bProof.d, this.pb, this.qb, this.pbqbProof.c, this.pbqbProof.d0, this.pbqbProof.d1],
    );
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
  static wireTypes = [
    BabyJubPoint,
    BabyJubPoint,
    BigInt,
    BigInt,
    BigInt,
    BabyJubPoint,
    BigInt,
    BigInt
  ];
  static tlvType = new Short(4);

  constructor(
    readonly pa: BabyJubPoint,
    readonly qa: BabyJubPoint,
    readonly paqaProof: ProofEqualDiscreteCoordinates,
    readonly ra: BabyJubPoint,
    readonly raProof: ProofEqualDiscreteLogs
  ) {
    super();
  }

  static fromTLV(tlv: TLV): SMPMessage3 {
    const elements = this.fromTLVToElements(this.tlvType, tlv);
    return new SMPMessage3(
      elements[0] as BabyJubPoint,
      elements[1] as BabyJubPoint,
      { c: elements[2] as BigInt, d0: elements[3] as BigInt, d1: elements[4] as BigInt },
      elements[5] as BabyJubPoint,
      { c: elements[6] as BigInt, d: elements[7] as BigInt },
    );
  }

  toTLV(): TLV {
    return SMPMessage3.fromElementsToTLV(
      SMPMessage3.tlvType,
      [
        this.pa,
        this.qa,
        this.paqaProof.c,
        this.paqaProof.d0,
        this.paqaProof.d1,
        this.ra,
        this.raProof.c,
        this.raProof.d
      ],
    );
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
  static wireTypes = [BabyJubPoint, BigInt, BigInt];
  static tlvType = new Short(5);

  constructor(
    readonly rb: BabyJubPoint,
    readonly rbProof: ProofEqualDiscreteLogs
  ) {
    super();
  }

  static fromTLV(tlv: TLV): SMPMessage4 {
    const elements = this.fromTLVToElements(this.tlvType, tlv);
    return new SMPMessage4(
      elements[0] as BabyJubPoint,
      { c: elements[1] as BigInt, d: elements[2] as BigInt },
    );
  }

  toTLV(): TLV {
    return SMPMessage4.fromElementsToTLV(
      SMPMessage4.tlvType,
      [this.rb, this.rbProof.c, this.rbProof.d]
    );
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
