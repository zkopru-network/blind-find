import BN from 'bn.js';

import { Short } from '../../src/smp/dataTypes';
import {
  BaseSMPMessage,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
  TLV,
} from '../../src/smp/msgs';
import {
  smpMessage1Factory,
  smpMessage2Factory,
  smpMessage3Factory,
  smpMessage4Factory,
} from '../../src/smp/factories';
import { ValueError } from '../../src/smp/exceptions';
import { MultiplicativeGroup } from '../../src/smp/multiplicativeGroup';
import { defaultConfig } from '../../src/smp/config';

describe('TLV', () => {
  test('succeeds', () => {
    const types = [new Short(3), new Short(5), new Short(7)];
    const values = [
      new Uint8Array([5566, 5577]),
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array([]),
    ];
    const expectedSerialized = [
      new Uint8Array([0, 3, 0, 2, 5566, 5577]),
      new Uint8Array([0, 5, 0, 5, 1, 2, 3, 4, 5]),
      new Uint8Array([0, 7, 0, 0]),
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
  test('deserialize fails', () => {
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

describe('BaseSMPMessage', () => {
  test('tlvToMPIs succeeds', () => {
    const bytes = new Uint8Array([
      0,
      0,
      0,
      2, // Int: length=2
      0,
      0,
      0,
      1,
      1, // 1
      0,
      0,
      0,
      1,
      2, // 2
    ]);
    const type = new Short(0);
    const tlv = new TLV(type, bytes);
    const mpis = BaseSMPMessage.tlvToMPIs(type, 2, tlv);
    expect(mpis[0].value.eqn(1)).toBeTruthy();
    expect(mpis[1].value.eqn(2)).toBeTruthy();
  });
  test('tlvToMPIs fails', () => {
    const bytes = new Uint8Array([
      0,
      0,
      0,
      2, // Int: length=2
      0,
      0,
      0,
      1,
      1, // 1
      0,
      0,
      0,
      1,
      2, // 2
    ]);
    const type = new Short(0);
    const tlv = new TLV(type, bytes);
    const typeAnother = new Short(1);
    // Wrong type
    expect(() => {
      BaseSMPMessage.tlvToMPIs(typeAnother, 2, tlv);
    }).toThrowError(ValueError);
    // Wrong length
    expect(() => {
      BaseSMPMessage.tlvToMPIs(type, 3, tlv);
    }).toThrowError(ValueError);
    // Invalid MPI format
    const wrongMPIs = new Uint8Array([
      0,
      0,
      0,
      1, // length=1
      0,
    ]);
    const wrongTLV = new TLV(type, wrongMPIs);
    expect(() => {
      BaseSMPMessage.tlvToMPIs(type, 2, wrongTLV);
    }).toThrowError(ValueError);
  });
});

describe('SMPMessages', () => {
  const q = defaultConfig.q;
  const areSMPMessagesEqual = (
    a: BaseSMPMessage,
    b: BaseSMPMessage
  ): boolean => {
    if (a.wireValues.length !== b.wireValues.length) {
      return false;
    }
    for (const index in a.wireValues) {
      const aField = a.wireValues[index];
      const bField = a.wireValues[index];
      if (aField instanceof BN && bField instanceof BN) {
        return aField.eq(bField);
      } else if (
        aField instanceof MultiplicativeGroup &&
        bField instanceof MultiplicativeGroup
      ) {
        return aField.equal(bField);
      } else {
        return false;
      }
    }
    return true;
  };

  test('SMPMessage1 succeeds', () => {
    const msg = smpMessage1Factory();
    expect(
      areSMPMessagesEqual(msg, SMPMessage1.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
  test('SMPMessage2 succeeds', () => {
    const msg = smpMessage2Factory();
    expect(
      areSMPMessagesEqual(msg, SMPMessage2.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
  test('SMPMessage3 succeeds', () => {
    const msg = smpMessage3Factory();
    expect(
      areSMPMessagesEqual(msg, SMPMessage3.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
  test('SMPMessage4 succeeds', () => {
    const msg = smpMessage4Factory();
    expect(
      areSMPMessagesEqual(msg, SMPMessage4.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
});
