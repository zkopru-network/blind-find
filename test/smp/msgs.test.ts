import { Short } from "../../src/smp/serialization";
import {
  Scalar,
  Point,
  fromTLVToElements,
  fromElementsToTLV,
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire,
  SMPMessage4Wire
} from "../../src/smp/v4/serialization";
import { BaseSMPMessage } from "../../src/smp/msgs";
import { TLV } from "../../src/smp/serialization";
import {
  smpMessage1Factory,
  smpMessage2Factory,
  smpMessage3Factory,
  smpMessage4Factory
} from "../../src/smp/v4/factories";
import { ValueError } from "../../src/smp/exceptions";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";

import { expect } from 'chai';

describe("TLV", () => {
  it("succeeds", () => {
    const types = [new Short(3), new Short(5), new Short(7)];
    const values = [
      new Uint8Array([5566, 5577]),
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array([])
    ];
    const expectedSerialized = [
      new Uint8Array([0, 3, 0, 2, 5566, 5577]),
      new Uint8Array([0, 5, 0, 5, 1, 2, 3, 4, 5]),
      new Uint8Array([0, 7, 0, 0])
    ];
    for (const index in values) {
      const type = types[index];
      const value = values[index];
      const tlv = new TLV(type, value);
      const expected = expectedSerialized[index];
      expect(tlv.serialize()).to.eql(expected);
      const tlvFromExpected = TLV.deserialize(expected);
      expect(tlvFromExpected.type.value).to.eql(tlv.type.value);
      expect(tlvFromExpected.value).to.eql(tlv.value);
    }
  });
  it("deserialize fails", () => {
    // Empty
    expect(() => {
      TLV.deserialize(new Uint8Array([]));
    }).to.throw(ValueError);
    // Wrong length
    expect(() => {
      TLV.deserialize(new Uint8Array([0, 0, 0, 3, 1, 1]));
    }).to.throw(ValueError);
  });
});

describe("tlv and elements", () => {
  const t = new Short(1);
  const p = new Point([
    BigInt(
      "17777552123799933955779906779655732241715742912184938656739573121738514868268"
    ),
    BigInt(
      "2626589144620713026669568689430873010625803728049924121243784502389097019475"
    )
  ]);
  const pObj = new BabyJubPoint(p.point);
  const s = new Scalar(4);
  const sObj = s.value;
  const elements = [pObj, sObj, sObj, pObj, sObj, sObj];
  const bytes = new Uint8Array([
    ...p.serialize(),
    ...s.serialize(),
    ...s.serialize(),
    ...p.serialize(),
    ...s.serialize(),
    ...s.serialize()
  ]);
  const tlv = new TLV(t, bytes);
  const wireFormats = [
    BabyJubPoint,
    BigInt,
    BigInt,
    BabyJubPoint,
    BigInt,
    BigInt
  ];

  it("fromTLVToElements", () => {
    const values = fromTLVToElements(t, wireFormats, tlv);
    expect(values).to.eql(elements);
  });

  it("fromElementsToTLV", () => {
    const tlv2 = fromElementsToTLV(t, wireFormats, elements);
    expect(tlv2.type.value).to.eql(tlv.type.value);
    expect(tlv2.value).to.eql(tlv.value);
  });

  it("fromElementsToTLV(fromTLVToElements(tlv))", () => {
    const tlv2 = fromElementsToTLV(
      t,
      wireFormats,
      fromTLVToElements(t, wireFormats, tlv)
    );
    expect(tlv2.type.value).to.eql(tlv.type.value);
    expect(tlv2.value).to.eql(tlv.value);
  });
});

describe("SMPMessages", () => {
  const areSMPMessagesEqual = (a: BaseSMPMessage, b: BaseSMPMessage): void => {
    const tlvA = a.toTLV();
    const tlvB = b.toTLV();
    expect(tlvA.type.value).to.eql(tlvB.type.value);
    expect(tlvA.value).to.eql(tlvB.value);
  };

  it("SMPMessage1 succeeds", () => {
    const msg = smpMessage1Factory();
    areSMPMessagesEqual(msg, SMPMessage1Wire.fromTLV(msg.toTLV()));
  });

  it("SMPMessage2 succeeds", () => {
    const msg = smpMessage2Factory();
    areSMPMessagesEqual(msg, SMPMessage2Wire.fromTLV(msg.toTLV()));
  });

  it("SMPMessage3 succeeds", () => {
    const msg = smpMessage3Factory();
    areSMPMessagesEqual(msg, SMPMessage3Wire.fromTLV(msg.toTLV()));
  });
  it("SMPMessage4 succeeds", () => {
    const msg = smpMessage4Factory();
    areSMPMessagesEqual(msg, SMPMessage4Wire.fromTLV(msg.toTLV()));
  });
});
