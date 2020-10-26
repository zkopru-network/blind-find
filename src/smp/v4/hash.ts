import { hash5 } from "maci-crypto";
import { ValueError } from "../exceptions";

/**
 * SMP hash function. Poseidon is used with `version` as prefix.
 * @param version - This distinguishes calls to the hash function at different points in the protocol,
 * to prevent Alice from replaying Bob's zero knowledge proofs or vice versa.
 * @param args - The arguments. Since we use `hash5`, length of `args` is at most 4.
 * @returns The hash result as an BigInt type integer.
 */
export function smpHash(version: number, ...args: BigInt[]): BigInt {
  const numTotalArgs = 5;
  // `version` is counted an argument, there should only be `numArgs - 1` arguments passed to
  // this function.
  if (args.length > numTotalArgs - 1) {
    throw new ValueError("too many arguments");
  }
  // Pad `0` to make args of length `numTotalArgs`.
  const elements: BigInt[] = [BigInt(version), ...args];
  for (let i = 0; i < numTotalArgs - elements.length; i++) {
    elements.push(BigInt(0));
  }
  return hash5(elements);
}
