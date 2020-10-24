/**
 * Factory functions used for testing.
 */

import { q, G } from "./config";

import { genPrivKey, genPubKey } from "maci-crypto";
import { IGroup } from "./interfaces";
import { BabyJubPoint } from "./babyJub";

import {
  TLV,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4
} from "./msgs";
import {
  makeProofDiscreteLog,
  makeProofEqualDiscreteLogs,
  makeProofEqualDiscreteCoordinates
} from "./proofs";
import { smpHash } from "./hash";

import { babyJubPointToScalar } from "./utils";

function secretFactory(): BigInt {
  return genPrivKey();
}

function babyJubPointFactory(): BabyJubPoint {
  return new BabyJubPoint(genPubKey(secretFactory()));
}

const version = 1;

function hash(...args: IGroup[]): BigInt {
  return smpHash(
    version,
    ...args.map((g: IGroup) => {
      return babyJubPointToScalar(g as BabyJubPoint);
    })
  );
}

function smpMessage1Factory(): SMPMessage1 {
  const g = babyJubPointFactory();
  const bn = secretFactory();
  const proofDiscreteLog = makeProofDiscreteLog(hash, g, bn, bn, q);
  return new SMPMessage1(g, proofDiscreteLog, g, proofDiscreteLog);
}

function smpMessage2Factory(): SMPMessage2 {
  const g = new BabyJubPoint(G);
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
  return new SMPMessage2(
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
  return new SMPMessage3(g, g, proofEDC, g, proofEDL);
}

function smpMessage4Factory(): SMPMessage4 {
  const g = babyJubPointFactory();
  const bn = secretFactory();
  const q = secretFactory();
  const proofEDL = makeProofEqualDiscreteLogs(hash, g, g, bn, bn, q);
  return new SMPMessage4(g, proofEDL);
}

function tlvFactory(): TLV {
  return TLV.deserialize(new Uint8Array([0, 7, 0, 0]));
}

export {
  secretFactory,
  babyJubPointFactory,
  tlvFactory,
  smpMessage1Factory,
  smpMessage2Factory,
  smpMessage3Factory,
  smpMessage4Factory
};
