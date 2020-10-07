/**
 * Factory functions used for testing.
 */

import { randomBytes } from 'crypto';

import BN from 'bn.js';

import { defaultConfig } from './config';
import { MultiplicativeGroup } from './multiplicativeGroup';
import {
  TLV,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
} from '../../src/smp/msgs';
import {
  makeProofDiscreteLog,
  makeProofEqualDiscreteLogs,
  makeProofEqualDiscreteCoordinates,
} from '../../src/smp/proofs';
import { smpHash } from '../../src/smp/hash';

function secretFactory(): BN {
  const buf = randomBytes(defaultConfig.modulusSize);
  return new BN(buf.toString('hex'), 'hex').umod(defaultConfig.q);
}

function multiplicativeGroupFactory(): MultiplicativeGroup {
  const secret = secretFactory();
  return defaultConfig.g.exponentiate(secret);
}

const version = 1;

function hash(...args: BN[]): BN {
  return smpHash(version, ...args);
}

function smpMessage1Factory(): SMPMessage1 {
  const g = defaultConfig.g;
  const bn = secretFactory();
  const q = defaultConfig.q;
  const proofDiscreteLog = makeProofDiscreteLog(hash, g, bn, bn, q);
  return new SMPMessage1(g, proofDiscreteLog, g, proofDiscreteLog);
}

function smpMessage2Factory(): SMPMessage2 {
  const g = multiplicativeGroupFactory();
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
  const g = multiplicativeGroupFactory();
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
  const g = multiplicativeGroupFactory();
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
  multiplicativeGroupFactory,
  tlvFactory,
  smpMessage1Factory,
  smpMessage2Factory,
  smpMessage3Factory,
  smpMessage4Factory,
};
