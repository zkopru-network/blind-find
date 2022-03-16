import BN from "bn.js";
import { hash5, Plaintext } from "maci-crypto";
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

export const bigIntToHexString = (n: BigInt): string => {
  return new BN(n.toString()).toString("hex");
};

export function stringifyBigInts(o) {
  if (typeof o == "bigint" || o.eq !== undefined) {
    return o.toString(10);
  } else if (Array.isArray(o)) {
    return o.map(stringifyBigInts);
  } else if (typeof o == "object") {
    const res = {};
    const keys = Object.keys(o);
    keys.forEach((k) => {
      res[k] = stringifyBigInts(o[k]);
    });
    return res;
  } else {
    return o;
  }
}

export function unstringifyBigInts(o) {
  if (typeof o == "string" && /^[0-9]+$/.test(o)) {
    return BigInt(o);
  } else if (typeof o == "string" && /^0x[0-9a-fA-F]+$/.test(o)) {
    return BigInt(o);
  } else if (Array.isArray(o)) {
    return o.map(unstringifyBigInts);
  } else if (typeof o == "object") {
    const res = {};
    const keys = Object.keys(o);
    keys.forEach((k) => {
      res[k] = unstringifyBigInts(o[k]);
    });
    return res;
  } else {
    return o;
  }
}

export function stringToPlaintext(str: string): Plaintext {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str)).map((v) => BigInt(v));
}

export function plaintextToString(plain: Plaintext): string {
  const decoder = new TextDecoder();
  return decoder.decode(
    Uint8Array.from(plain.map((v) => Number(v.toString())))
  );
}
