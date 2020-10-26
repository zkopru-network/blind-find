import { SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 } from "./msgs";
import { THashFunc, TypeTLVOrNull } from "./types";
/**
 * A general interface of a [group element](https://en.wikipedia.org/wiki/Group_(mathematics)).
 */
interface IGroup {
  /**
   * The element is valid or not. This is not done in the constructor to avoid the costly computation.
   */
  isValid(): boolean;
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

interface ISMPState {
  /**
   * Transit the current state to the next state with the given `msg`.
   * @param msg - A SMP Message of `TLV` format.
   * @returns The next state, and a SMP Message to reply(if any).
   */
  transit(msg: TypeTLVOrNull): [ISMPState, TypeTLVOrNull];
  /**
   * Return the result of SMP protocol.
   * @returns The result if this state has a result(i.e. the protocol is finished). Otherwise,
   *  `null` is returned.
   */
  getResult(): boolean | null;
}

interface ISMPConfig {
  q: BigInt;
  g1: IGroup;
  getHashFunc(version: number): THashFunc;
  getRandomSecret(): BigInt;
  wireFormats: {
    SMPMessage1: typeof SMPMessage1;
    SMPMessage2: typeof SMPMessage2;
    SMPMessage3: typeof SMPMessage3;
    SMPMessage4: typeof SMPMessage4;
  };
}

export { IGroup, ISMPState, ISMPConfig };
