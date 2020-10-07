import BN from 'bn.js';

import { MODULUS, MODULUS_BITS, GENERATOR, ENDIAN } from './constants';
import { MultiplicativeGroup } from './multiplicativeGroup';

const modulusInt = new BN(MODULUS.replace('\n', '').replace(' ', ''), 'hex');

type Config = {
  modulus: BN; // The modulus for the multiplicative group
  modulusSize: number; // Number of bytes a modulus occupies
  q: BN; // The modulus when generating proofs
  g: MultiplicativeGroup; // The generator of the group
  endian: 'be' | 'le'; // The order of bytes for a binary representation
};

const defaultConfig: Config = {
  modulus: modulusInt,
  modulusSize: MODULUS_BITS / 8,
  q: modulusInt.subn(1).divn(2), // q = (p - 1) / 2
  g: new MultiplicativeGroup(modulusInt, new BN(GENERATOR)),
  endian: ENDIAN,
};

export { Config, defaultConfig };
