import BN from 'bn.js';

import { smpHash } from '../../src/smp/hash';

describe('smpHash', () => {
  const version1 = 1;
  const version2 = 2;
  const args1 = [new BN(1), new BN(2)];
  const args2 = [new BN(2), new BN(2)];

  test('hardcoded test', () => {
    // empty args
    expect(smpHash(version1)).toEqual(
      new BN(
        '4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a',
        'hex'
      )
    );
    // with args
    expect(smpHash(version1, ...args1)).toEqual(
      new BN(
        'c978fefeb22ed51f470af5e695f4159d3bd19f6da8e272762e3e4252efcb6431',
        'hex'
      )
    );
  });

  test('same versions and args', () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version1, ...args1);
    expect(res1.eq(res2)).toBeTruthy();
  });

  test('same versions but different args', () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version1, ...args2);
    expect(res1.eq(res2)).toBeFalsy();
  });

  test('different versions and same args', () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version2, ...args1);
    expect(res1.eq(res2)).toBeFalsy();
  });

  test('different versions and different args', () => {
    const res1 = smpHash(version1, ...args1);
    const res2 = smpHash(version2, ...args2);
    expect(res1.eq(res2)).toBeFalsy();
  });
});
