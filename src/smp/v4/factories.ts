/**
 * Factory functions used for testing.
 */
import { genPrivKey, genPubKey } from "maci-crypto";

import { BabyJubPoint } from "./babyJub";
import { q, getHashFunc } from "./state";
import {
  SMPMessage4Wire,
  SMPMessage3Wire,
  SMPMessage2Wire,
  SMPMessage1Wire
} from "./serialization";

import { IGroup } from "../interfaces";
import { SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 } from "../msgs";
import {
  makeProofDiscreteLog,
  makeProofEqualDiscreteLogs,
  makeProofEqualDiscreteCoordinates
} from "../proofs";
import { TLV } from "../serialization";
import { bigIntMod } from "../utils";

function secretFactory(): BigInt {
  return bigIntMod(genPrivKey(), q);
}

function babyJubPointFactory(): BabyJubPoint {
  return new BabyJubPoint(genPubKey(secretFactory()));
}

function hash(...args: IGroup[]): BigInt {
  const version = 1;
  return getHashFunc(version)(...args);
}

function smpMessage1Factory(): SMPMessage1 {
  const g = babyJubPointFactory();
  const bn = secretFactory();
  const proofDiscreteLog = makeProofDiscreteLog(hash, g, bn, bn, q);
  return new SMPMessage1Wire(g, proofDiscreteLog, g, proofDiscreteLog);
}

function smpMessage2Factory(): SMPMessage2 {
  const g = babyJubPointFactory();
  const bn = secretFactory();
  const q = secretFactory();
  const proofDiscreteLog = makeProofDiscreteLog(hash, g, bn, bn, q);
  const proofEDC = makeProofEqualDiscreteCoordinates(
    hash,
    g,
    g,
    g,
    bn,
    bn,
    bn,
    bn,
    q
  );
  return new SMPMessage2Wire(
    g,
    proofDiscreteLog,
    g,
    proofDiscreteLog,
    g,
    g,
    proofEDC
  );
}

function smpMessage3Factory(): SMPMessage3 {
  const g = babyJubPointFactory();
  const bn = secretFactory();
  const q = secretFactory();
  const proofEDC = makeProofEqualDiscreteCoordinates(
    hash,
    g,
    g,
    g,
    bn,
    bn,
    bn,
    bn,
    q
  );
  const proofEDL = makeProofEqualDiscreteLogs(hash, g, g, bn, bn, q);
  return new SMPMessage3Wire(g, g, proofEDC, g, proofEDL);
}

function smpMessage4Factory(): SMPMessage4 {
  const g = babyJubPointFactory();
  const bn = secretFactory();
  const q = secretFactory();
  const proofEDL = makeProofEqualDiscreteLogs(hash, g, g, bn, bn, q);
  return new SMPMessage4Wire(g, proofEDL);
}

function tlvFactory(): TLV {
  return TLV.deserialize(new Uint8Array([0, 7, 0, 0]));
}

export {
  hash,
  secretFactory,
  babyJubPointFactory,
  tlvFactory,
  smpMessage1Factory,
  smpMessage2Factory,
  smpMessage3Factory,
  smpMessage4Factory
};
