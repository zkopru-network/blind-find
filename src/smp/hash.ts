import BN from 'bn.js';
import { sha256 } from 'js-sha256';

import { MPI, Byte } from './dataTypes';
import { concatUint8Array } from './utils';

/**
 * SMP Hash function. SHA256 is used with `version` as the prefix.
 * @param version - This distinguishes calls to the hash function at different points in the protocol,
 * to prevent Alice from replaying Bob's zero knowledge proofs or vice versa. It is serialized as a
 * [[Byte]] type.
 * @param args - The arguments. Each of them is serialized as [[MPI]] type.
 * @returns The hash result as an [[BN]] type integer.
 */
export function smpHash(version: number, ...args: BN[]): BN {
  let res = new Byte(version).serialize();
  for (const arg of args) {
    res = concatUint8Array(res, new MPI(arg).serialize());
  }
  return new BN(sha256(res), 'hex');
}
