import { Scalar, Point, Short } from "../../src/smp/dataTypes";
import {
  BaseSMPMessage,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
  TLV,
} from "../../src/smp/msgs";
import {
  smpMessage1Factory,
  smpMessage2Factory,
  smpMessage3Factory,
  smpMessage4Factory
} from "../../src/smp/factories";
import { ValueError } from "../../src/smp/exceptions";
import { BabyJubPoint } from "../../src/smp/babyJub";

describe("TLV", () => {
  test("succeeds", () => {
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
      expect(tlv.serialize()).toEqual(expected);
      const tlvFromExpected = TLV.deserialize(expected);
      expect(tlvFromExpected.type.value).toEqual(tlv.type.value);
      expect(tlvFromExpected.value).toEqual(tlv.value);
    }
  });
  test("deserialize fails", () => {
    // Empty
    expect(() => {
      TLV.deserialize(new Uint8Array([]));
    }).toThrowError(ValueError);
    // Wrong length
    expect(() => {
      TLV.deserialize(new Uint8Array([0, 0, 0, 3, 1, 1]));
    }).toThrowError(ValueError);
  });
});

describe("BaseSMPMessage", () => {
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
  const elements = [
    pObj, sObj, sObj, pObj, sObj, sObj
  ];
  const bytes = new Uint8Array([
    ...p.serialize(),
    ...s.serialize(),
    ...s.serialize(),
    ...p.serialize(),
    ...s.serialize(),
    ...s.serialize(),
  ]);
  const tlv = new TLV(t, bytes);

  test('fromTLVToElements', () => {
    const values = SMPMessage1.fromTLVToElements(t, tlv);
    expect(values).toEqual(elements);
  });

  test('fromElementsToTLV', () => {
    const tlv2 = SMPMessage1.fromElementsToTLV(t, elements);
    expect(tlv2.type.value).toEqual(tlv.type.value);
    expect(tlv2.value).toEqual(tlv.value);
  });

  test('fromElementsToTLV(fromTLVToElements(tlv))', () => {
    const tlv2 = SMPMessage1.fromElementsToTLV(t, SMPMessage1.fromTLVToElements(t, tlv));
    expect(tlv2.type.value).toEqual(tlv.type.value);
    expect(tlv2.value).toEqual(tlv.value);
  });

});

describe("SMPMessages", () => {
  const areSMPMessagesEqual = (
    a: BaseSMPMessage,
    b: BaseSMPMessage
  ): void => {
    const tlvA = a.toTLV();
    const tlvB = b.toTLV();
    expect(tlvA.type.value).toEqual(tlvB.type.value);
    expect(tlvA.value).toEqual(tlvB.value);
  };

  test("SMPMessage1 succeeds", () => {
    const msg = smpMessage1Factory();
    areSMPMessagesEqual(msg, SMPMessage1.fromTLV(msg.toTLV()));
  });

  test("SMPMessage2 succeeds", () => {
    const msg = smpMessage2Factory();
    areSMPMessagesEqual(msg, SMPMessage2.fromTLV(msg.toTLV()));
  });

  test("SMPMessage3 succeeds", () => {
    const msg = smpMessage3Factory();
    areSMPMessagesEqual(msg, SMPMessage3.fromTLV(msg.toTLV()));
  });
  test("SMPMessage4 succeeds", () => {
    const msg = smpMessage4Factory();
    areSMPMessagesEqual(msg, SMPMessage4.fromTLV(msg.toTLV()));
  });
});
