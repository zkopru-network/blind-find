import { poseidon } from 'circomlib';

// FIXME:
//  1. Should change this function to `HashToScalar`, as described in
//   https://github.com/otrv4/otrv4/blob/master/otrv4.md#hashtoscalar.
//  2. Confirm whether to use `poseidon` from circomlib or hashX(X is the number of the elements)
//    from maci-crypto?
/**
 * SMP Hash function. Poseidon is used with `version` as the prefix.
 * @param version - This distinguishes calls to the hash function at different points in the protocol,
 * to prevent Alice from replaying Bob's zero knowledge proofs or vice versa.
 * @param args - The arguments. Each of them is serialized as [[MPI]] type.
 * @returns The hash result as an [[BN]] type integer.
 */
export function smpHash(version: number, ...args: BigInt[]): BigInt {
  return poseidon([BigInt(version), ...args]);
}
