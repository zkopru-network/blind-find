import BN from 'bn.js';

/**
 * A general interface of a [group element](https://en.wikipedia.org/wiki/Group_(mathematics)).
 */
interface IGroup {
  /**
   * The identity element in the group, i.e. for every element `a` in `IGroup`,
   * `a.operate(a.identity())` is equaled to `a`.
   *
   * @returns The identity element.
   */
  identity(): IGroup;
  /**
   * Operate with another group element, i.e. a * g.
   *
   * @param g - Another group element.
   * @returns A new element storing the result.
   */
  operate(g: IGroup): IGroup;
  /**
   * The inverse of this element, i.e. for every `a` in `IGroup`, `a.operate(a.inverse())`
   * is equaled to `a`.
   *
   */
  inverse(): IGroup;
  /**
   * Operate the element `exponent` times, i.e. a^exponent.
   *
   * @param exponent - Times the element is going to be operated.
   * @returns A new element storing the result.
   */
  exponentiate(exponent: BN): IGroup;
  /**
   * The element is equaled to `g` or not.
   *
   * @param g - Another group element.
   * @returns true if yes else false.
   */
  equal(g: IGroup): boolean;
}

/**
 * A base class for a group element with `exponentiate` implemented.
 */
abstract class BaseGroup implements IGroup {
  abstract identity(): BaseGroup;
  abstract operate(g: BaseGroup): BaseGroup;
  abstract inverse(): BaseGroup;
  abstract equal(g: BaseGroup): boolean;
  exponentiate(exponent: BN): BaseGroup {
    let cur: BaseGroup = this;
    let y = this.identity();
    if (exponent.isNeg()) {
      cur = cur.inverse();
      exponent = exponent.neg();
    }
    if (exponent.isZero()) {
      return y;
    }
    while (exponent.gtn(1)) {
      if (exponent.isEven()) {
        cur = cur.operate(cur);
        exponent = exponent.divn(2);
      } else {
        y = cur.operate(y);
        cur = cur.operate(cur);
        exponent = exponent.subn(1).divn(2);
      }
    }
    return y.operate(cur);
  }
}

/**
 * An implementation of the [Multiplicative group of integer modulo n](https://en.wikipedia.org/wiki/Multiplicative_group_of_integers_modulo_n).
 */
class MultiplicativeGroup extends BaseGroup {
  /**
   * @param n - Modulus of the multiplicative group.
   * @param value - Value of this element.
   */
  constructor(readonly n: BN, readonly value: BN) {
    super();
  }
  /**
   * The element is valid or not. This is not done in the constructor to avoid the costly
   * `gcd` computation.
   */
  isValid(): boolean {
    return this.value.gcd(this.n).eqn(1);
  }
  identity(): MultiplicativeGroup {
    return new MultiplicativeGroup(this.n, new BN(1));
  }
  inverse(): MultiplicativeGroup {
    const value = this.value.invm(this.n);
    return new MultiplicativeGroup(this.n, value);
  }
  operate(g: MultiplicativeGroup): MultiplicativeGroup {
    const value = this.value.mul(g.value);
    return new MultiplicativeGroup(this.n, value.umod(this.n));
  }
  equal(this: MultiplicativeGroup, g: MultiplicativeGroup): boolean {
    return this.n.eq(g.n) && this.value.eq(g.value);
  }
  exponentiate(exponent: BN): MultiplicativeGroup {
    return super.exponentiate(exponent) as MultiplicativeGroup;
  }
}

export { IGroup, MultiplicativeGroup };
