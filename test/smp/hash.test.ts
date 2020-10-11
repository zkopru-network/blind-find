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
      new BN('11043376183861534927536506085090418075369306574649619885724436265926427398571')
    );
    // with args
    expect(smpHash(version1, ...args1)).toEqual(
      new BN('14310149773551574902625093186505070205511254386626408950633442520926831567720')
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
