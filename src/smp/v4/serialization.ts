/**
 * Data types used in SMP protocol in OTR.
 * Ref: https://github.com/otrv4/otrv4/blob/master/otrv4.md#data-types
 */

import { babyJub } from "circomlib";

import { BabyJubPoint } from "./babyJub";
import { ECPoint } from "./types";

import { LITTLE_ENDIAN } from "../constants";
import { ValueError } from "../exceptions";
import { IGroup } from "../interfaces";
import { SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 } from "../msgs";
import {
  BaseSerializable,
  BaseFixedInt,
  Short,
  TLV,
  createFixedIntClass
} from "../serialization";
import { concatUint8Array } from "../utils";
import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs
} from "../proofs";

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

/**
 * TODO: Consider extending from `TLV`.
 * SMP Message TLVs (types 2-5) carry two possible types: `Scalar` and `Point`.
 */

type SMPMessageElement = BigInt | IGroup;
type SMPMessageElementList = SMPMessageElement[];
type WireTypes = (typeof BigInt | typeof BabyJubPoint)[];

function fromTLVToElements(
  expectedMsgType: BaseFixedInt,
  wireTypes: WireTypes,
  tlv: TLV
): SMPMessageElementList {
  if (expectedMsgType.value !== tlv.type.value) {
    throw new ValueError(
      `type mismatch: type.value=${expectedMsgType.value}, tlv.type.value=${tlv.type.value}`
    );
  }
  let bytes = tlv.value;
  const res: SMPMessageElementList = [];
  for (const t of wireTypes) {
    let value: SMPMessageElement;
    if (t === BigInt) {
      value = Scalar.deserialize(bytes.slice(0, Scalar.size)).value;
      bytes = bytes.slice(Scalar.size);
    } else {
      value = new BabyJubPoint(
        Point.deserialize(bytes.slice(0, Point.size)).point
      );
      bytes = bytes.slice(Point.size);
    }
    res.push(value);
  }
  return res;
}

function fromElementsToTLV(
  msgType: BaseFixedInt,
  wireTypes: WireTypes,
  elements: SMPMessageElementList
): TLV {
  if (elements.length !== wireTypes.length) {
    throw new ValueError("length mismatch between elements and wireTypes");
  }
  let res = new Uint8Array([]);
  for (const index in wireTypes) {
    let valueBytes: Uint8Array;
    const t = wireTypes[index];
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

class SMPMessage1Wire extends SMPMessage1 {
  static wireTypes = [
    BabyJubPoint,
    BigInt,
    BigInt,
    BabyJubPoint,
    BigInt,
    BigInt
  ];
  static tlvType = new Short(2);

  constructor(
    readonly g2a: BabyJubPoint,
    readonly g2aProof: ProofDiscreteLog,
    readonly g3a: BabyJubPoint,
    readonly g3aProof: ProofDiscreteLog
  ) {
    super(g2a, g2aProof, g3a, g3aProof);
  }

  static fromTLV(tlv: TLV): SMPMessage1Wire {
    const elements = fromTLVToElements(this.tlvType, this.wireTypes, tlv);
    return new SMPMessage1Wire(
      elements[0] as BabyJubPoint,
      { c: elements[1] as BigInt, d: elements[2] as BigInt },
      elements[3] as BabyJubPoint,
      { c: elements[4] as BigInt, d: elements[5] as BigInt }
    );
  }

  toTLV(): TLV {
    return fromElementsToTLV(
      SMPMessage1Wire.tlvType,
      SMPMessage1Wire.wireTypes,
      [
        this.g2a,
        this.g2aProof.c,
        this.g2aProof.d,
        this.g3a,
        this.g3aProof.c,
        this.g3aProof.d
      ]
    );
  }
}

class SMPMessage2Wire extends SMPMessage2 {
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
    super(g2b, g2bProof, g3b, g3bProof, pb, qb, pbqbProof);
  }

  static fromTLV(tlv: TLV): SMPMessage2Wire {
    const elements = fromTLVToElements(this.tlvType, this.wireTypes, tlv);
    return new SMPMessage2Wire(
      elements[0] as BabyJubPoint,
      { c: elements[1] as BigInt, d: elements[2] as BigInt },
      elements[3] as BabyJubPoint,
      { c: elements[4] as BigInt, d: elements[5] as BigInt },
      elements[6] as BabyJubPoint,
      elements[7] as BabyJubPoint,
      {
        c: elements[8] as BigInt,
        d0: elements[9] as BigInt,
        d1: elements[10] as BigInt
      }
    );
  }

  toTLV(): TLV {
    return fromElementsToTLV(
      SMPMessage2Wire.tlvType,
      SMPMessage2Wire.wireTypes,
      [
        this.g2b,
        this.g2bProof.c,
        this.g2bProof.d,
        this.g3b,
        this.g3bProof.c,
        this.g3bProof.d,
        this.pb,
        this.qb,
        this.pbqbProof.c,
        this.pbqbProof.d0,
        this.pbqbProof.d1
      ]
    );
  }
}

class SMPMessage3Wire extends SMPMessage3 {
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
    super(pa, qa, paqaProof, ra, raProof);
  }

  static fromTLV(tlv: TLV): SMPMessage3Wire {
    const elements = fromTLVToElements(this.tlvType, this.wireTypes, tlv);
    return new SMPMessage3Wire(
      elements[0] as BabyJubPoint,
      elements[1] as BabyJubPoint,
      {
        c: elements[2] as BigInt,
        d0: elements[3] as BigInt,
        d1: elements[4] as BigInt
      },
      elements[5] as BabyJubPoint,
      { c: elements[6] as BigInt, d: elements[7] as BigInt }
    );
  }

  toTLV(): TLV {
    return fromElementsToTLV(
      SMPMessage3Wire.tlvType,
      SMPMessage3Wire.wireTypes,
      [
        this.pa,
        this.qa,
        this.paqaProof.c,
        this.paqaProof.d0,
        this.paqaProof.d1,
        this.ra,
        this.raProof.c,
        this.raProof.d
      ]
    );
  }
}

class SMPMessage4Wire extends SMPMessage4 {
  static wireTypes = [BabyJubPoint, BigInt, BigInt];
  static tlvType = new Short(5);

  constructor(
    readonly rb: BabyJubPoint,
    readonly rbProof: ProofEqualDiscreteLogs
  ) {
    super(rb, rbProof);
  }

  static fromTLV(tlv: TLV): SMPMessage4Wire {
    const elements = fromTLVToElements(this.tlvType, this.wireTypes, tlv);
    return new SMPMessage4Wire(elements[0] as BabyJubPoint, {
      c: elements[1] as BigInt,
      d: elements[2] as BigInt
    });
  }

  toTLV(): TLV {
    return fromElementsToTLV(
      SMPMessage4Wire.tlvType,
      SMPMessage4Wire.wireTypes,
      [this.rb, this.rbProof.c, this.rbProof.d]
    );
  }
}

export {
  Point,
  Scalar,
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire,
  SMPMessage4Wire,
  fromTLVToElements,
  fromElementsToTLV
};
