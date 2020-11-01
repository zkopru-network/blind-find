/**
 * SMP state and state machine
 */
import BN from "bn.js";
import { babyJub } from "circomlib";
import { sha256 } from "js-sha256";
import { genPrivKey } from "maci-crypto";

import { BabyJubPoint } from "./babyJub";
import { smpHash } from "./hash";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire,
  SMPMessage4Wire
} from "./serialization";
import { ECPoint } from "./types";

import { BIG_ENDIAN } from "../constants";
import { IGroup } from "../interfaces";
import { THashFunc, TSecret } from "../types";
import { bigIntMod, uint8ArrayToBigInt } from "../utils";
import { BaseSMPStateMachine, SMPState1 } from "../state";
import { ValueError } from "../exceptions";

const q = babyJub.subOrder as BigInt;
const G = babyJub.Base8 as ECPoint;

function getHashFunc(version: number): THashFunc {
  return (...args: IGroup[]): BigInt => {
    const argsBigInts: BigInt[] = [];
    // Because one point is hashed as scalar for convenience, we can at most have
    // 2 arguments.
    if (args.length > 2) {
      throw new ValueError("too many arguments");
    }
    for (const arg of args) {
      const argPoint = arg as BabyJubPoint;
      argsBigInts.push(argPoint.point[0]);
      argsBigInts.push(argPoint.point[1]);
    }
    return smpHash(version, ...argsBigInts);
  };
}

function getRandomSecret(): BigInt {
  return bigIntMod(genPrivKey(), q);
}

/**
 * Transform the secret from different types to the internal type `BigInt`. Multiple types are
 * accepted for the secret to make it convenient for users, but we use `BigInt` internally.
 *
 * @param x - Our SMP secret.
 */
function normalizeSecret(x: TSecret): BigInt {
  let res: BigInt;
  if (typeof x === "number") {
    res = BigInt(x);
  } else if (typeof x === "string") {
    res = BigInt(new BN(sha256(x), "hex").toString());
  } else if (x instanceof Uint8Array) {
    res = uint8ArrayToBigInt(x, BIG_ENDIAN);
  } else if (typeof x === "bigint") {
    res = x;
  } else {
    // Sanity check
    throw new ValueError("secret can only be the type of `TSecret`");
  }
  return bigIntMod(res, q);
}

class SMPStateMachine extends BaseSMPStateMachine {
  /**
   * @param x - Our secret to be compared in SMP protocol.
   */
  constructor(x: TSecret) {
    super(
      new SMPState1(normalizeSecret(x), {
        q: q,
        g1: new BabyJubPoint(G),
        getHashFunc: getHashFunc,
        getRandomSecret: getRandomSecret,
        wireFormats: {
          SMPMessage1: SMPMessage1Wire,
          SMPMessage2: SMPMessage2Wire,
          SMPMessage3: SMPMessage3Wire,
          SMPMessage4: SMPMessage4Wire
        }
      })
    );
  }

  // TODO: Add initiate, which makes `transit` get rid of `null`.
}

export { SMPStateMachine, getHashFunc, getRandomSecret, q, G };
