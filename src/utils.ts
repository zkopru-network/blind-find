import { hash5, PubKey } from "maci-crypto";
import { Point } from "./smp/v4/serialization";
import { ECPoint } from "./smp/v4/types";

/**
 * AsyncEvent allows set/wait in async code. WARNING: Not sure if it's safe between coroutines.
 */
export class AsyncEvent {
  private _isSet: boolean;
  private isWaited: boolean;
  private eventSetter?: (value?: any) => void;
  private eventWaiter: Promise<void>;

  constructor() {
    this.eventWaiter = new Promise<void>((res, _) => {
      this.eventSetter = res;
    });
    this._isSet = false;
    this.isWaited = false;
  }

  public get isSet() {
    return this._isSet;
  }

  set() {
    if (this._isSet) {
      return;
    }
    this._isSet = true;
    if (this.eventSetter === undefined) {
      throw new Error(
        "eventSetter is undefined, i.e. set is called before wait is called"
      );
    }
    this.eventSetter();
  }

  async wait() {
    if (this._isSet) {
      return;
    }
    if (this.isWaited) {
      throw new Error("waiting for a waited event");
    }
    this.isWaited = true;
    await this.eventWaiter;
  }
}

export const hashPointToScalar = (point: ECPoint): BigInt => {
  return hash5([point[0], point[1], BigInt(0), BigInt(0), BigInt(0)]);
};

export const isPubkeySame = (a: PubKey, b: PubKey) => {
  return a.length === b.length && a[0] === b[0] && a[1] === b[1];
};

export const getPubkeyB64 = (pubkey: PubKey) => {
  return Buffer.from(new Point(pubkey).serialize()).toString("base64");
}

export const getPubkeyB64Short = (pubkey: PubKey) => {
  return getPubkeyB64(pubkey).slice(0, 8);
}
