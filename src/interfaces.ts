// Copied from maci
export interface MerkleProof {
  pathElements: BigInt[][];
  indices: number[]; // 2 ** 53
  depth: number;
  root: BigInt;
  leaf: BigInt;
}
