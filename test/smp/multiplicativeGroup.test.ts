import BN from 'bn.js';

import { MultiplicativeGroup } from '../../src/smp/multiplicativeGroup';

describe('constructor', () => {
  test('succeeds', () => {
    new MultiplicativeGroup(new BN(35), new BN(9));
  });
});

describe('equal', () => {
  const g0 = new MultiplicativeGroup(new BN(35), new BN(9));
  const g1 = new MultiplicativeGroup(new BN(35), new BN(9));
  const g2 = new MultiplicativeGroup(new BN(35), new BN(4));
  const g3 = new MultiplicativeGroup(new BN(13), new BN(9));
  test('should be equal if both `n` and `value` are the same', () => {
    expect(g0.equal(g1)).toBeTruthy();
  });
  test('should not be equal if `value`s are not the same', () => {
    expect(g0.equal(g2)).toBeFalsy();
  });
  test('should not be equal if `n`s is not the same', () => {
    expect(g0.equal(g3)).toBeFalsy();
  });
});

describe('isValid', () => {
  test('should be invalid if the value and modulus are not co-prime', () => {
    const g = new MultiplicativeGroup(new BN(35), new BN(7));
    expect(g.isValid()).toBeFalsy();
  });
  test('should be valid if the value and modulus are co-prime', () => {
    const g = new MultiplicativeGroup(new BN(35), new BN(4));
    expect(g.isValid()).toBeTruthy();
  });
});

describe('identity', () => {
  test('hardcoded test', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    const identityExpected = new MultiplicativeGroup(new BN(35), new BN(1));
    expect(mg.identity().equal(identityExpected)).toBeTruthy();
  });
  test('every group element with the same modulus shares the same identity', () => {
    const mg0 = new MultiplicativeGroup(new BN(35), new BN(9));
    const mg1 = new MultiplicativeGroup(new BN(35), new BN(6));
    expect(mg0.identity().equal(mg1.identity())).toBeTruthy();
  });
});

describe('inverse', () => {
  test('hardcoded test', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    const inverseExpected = new MultiplicativeGroup(new BN(35), new BN(4));
    expect(mg.inverse().equal(inverseExpected)).toBeTruthy();
  });
});

describe('operate', () => {
  test('operate with identity', () => {
    const mg = new MultiplicativeGroup(new BN(35, 10), new BN(9));
    expect(mg.operate(mg.identity()).equal(mg)).toBeTruthy();
  });
  test('operate with inverse', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    expect(mg.operate(mg.inverse()).equal(mg.identity())).toBeTruthy();
  });
  test('hardcoded test', () => {
    const mg0 = new MultiplicativeGroup(new BN(35), new BN(9));
    const mg1 = new MultiplicativeGroup(new BN(35), new BN(6));
    const mgExpected = new MultiplicativeGroup(new BN(35), new BN(19));
    expect(mg0.operate(mg1).equal(mgExpected)).toBeTruthy();
  });
});

describe('exponentiate', () => {
  test('hardcoded test', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    const mgSquared = new MultiplicativeGroup(new BN(35), new BN(11));
    expect(mg.exponentiate(new BN(2)).equal(mgSquared)).toBeTruthy();
  });
  test('hardcoded test big number', () => {
    const g = new MultiplicativeGroup(
      new BN(
        'ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca237327ffffffffffffffff',
        16
      ),
      new BN(2)
    );
    const x = new BN(
      'cc4bd9d9057e526dc2546f9bac7179bd8c32f7ed76695087fa486643f3ad368b7d539585540a7b09be0ee9b76439ffe4656cc8db894e2616d837566423645a0746e55cc9b8ccbcdd3b9237f72f1e0cabed8444b6be85409b7155d70b33f0b8a7bae4ad8623ea50cb7fcafe82749f0aea06cdd377a7f835c54ab56fe7b03163f0e9267dbe20f7fe6fe15cf3ddafc7762d5e5b75fe2974a68d9abc542d7e4942f545e77db0feef79e5944fca72636833be353404209cdaf93c182131ff760cde47',
      16
    );
    const y = g.exponentiate(x);
    const yExpectedInt = new BN(
      'c2c19e5333d6a193f787a03fae908d128c82c2705803dad654e9455db4c9ef9b44cf9ca8e9829ccfafd4703f194b3e996546711319d0bb923c74d852883aeccbb09e2048995e90acb2ceee2ef0afa06dcff1360576c622ee71af4ec605224de01b93a418de644ae15d75eda6c50ad6fad1115eac8c53b151669779d72c041f02d64377daf0030d49089b2a1fcefab1036accba5d348e21971c5f702db077ba3d4c1cfb61e22b5b020c6fdcad86432a322dfa10b954f5303f036b3a778c519c25',
      16
    );
    expect(y.value.eq(yExpectedInt)).toBeTruthy();
  });
  test('exponentiate 0', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(4));
    expect(mg.exponentiate(new BN(0)).equal(mg.identity())).toBeTruthy();
  });
  test('exponentiation equals continuous multiplications', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(4));
    expect(mg.exponentiate(new BN(1)).equal(mg)).toBeTruthy();
    expect(mg.exponentiate(new BN(2)).equal(mg.operate(mg))).toBeTruthy();
  });
  test('exponentiate negative integers', () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(4));
    const mgNegSquare = mg.operate(mg).inverse();
    expect(mg.exponentiate(new BN(-2)).equal(mgNegSquare)).toBeTruthy();
  });
});
