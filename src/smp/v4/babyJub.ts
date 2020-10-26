import { babyJub } from "circomlib";

import { IGroup } from "../interfaces";
import { ECPoint } from "./types";

class BabyJubPoint implements IGroup {
  constructor(readonly point: ECPoint) {}
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
    return new BabyJubPoint(babyJub.addPoint(this.point, g.point) as ECPoint);
  }

  equal(g: BabyJubPoint): boolean {
    return this.point[0] === g.point[0] && this.point[1] === g.point[1];
  }

  exponentiate(exponent: BigInt): BabyJubPoint {
    let isNegative = false;
    if (BigInt(exponent) < 0) {
      isNegative = true;
      exponent = BigInt(exponent) * -1n;
    }
    let res = new BabyJubPoint(
      babyJub.mulPointEscalar(this.point, exponent) as ECPoint
    );
    if (isNegative) {
      return res.inverse();
    } else {
      return res;
    }
  }
}

export { BabyJubPoint };
