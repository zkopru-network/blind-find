import { Point } from './config';
import { babyJub } from 'circomlib';

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
  exponentiate(exponent: BigInt): IGroup;
  /**
   * The element is equaled to `g` or not.
   *
   * @param g - Another group element.
   * @returns true if yes else false.
   */
  equal(g: IGroup): boolean;
}

class BabyJubPoint implements IGroup {
  constructor(readonly point: Point) {
  }
  /**
   * The element is valid or not. This is not done in the constructor to avoid the costly computation.
   */
  isValid(): boolean {
    return babyJub.inSubgroup(this.point) as boolean;
  }

  identity(): BabyJubPoint {
    return new BabyJubPoint([babyJub.F.zero, babyJub.F.one]);
  }

  inverse(): BabyJubPoint {
    // Ref: https://en.wikipedia.org/wiki/Twisted_Edwards_curve#Addition_on_twisted_Edwards_curves
    return new BabyJubPoint([babyJub.F.neg(this.point[0]), this.point[1]]);
  }

  operate(g: BabyJubPoint): BabyJubPoint {
    return new BabyJubPoint(babyJub.addPoint(this.point, g.point) as Point);
  }

  equal(g: BabyJubPoint): boolean {
    return (this.point[0] == g.point[0]) && (this.point[1] == g.point[1]);
  }

  exponentiate(exponent: BigInt): BabyJubPoint {
    let isNegative = false;
    if (BigInt(exponent) < 0) {
      isNegative = true;
      exponent = BigInt(exponent) * (-1n);
    }
    let res = new BabyJubPoint(babyJub.mulPointEscalar(this.point, exponent) as Point);
    if (isNegative) {
      return res.inverse();
    } else {
      return res;
    }
  }
}

export { IGroup, BabyJubPoint };
