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

export { IGroup };
