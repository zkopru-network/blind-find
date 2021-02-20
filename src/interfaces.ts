// Copied from maci
export interface MerkleProof {
  pathElements: BigInt[][];
  indices: number[]; // 2 ** 53
  depth: number;
  root: BigInt;
  leaf: BigInt;
}

interface IDB {
  get(key: string): Promise<any>;
  set(key: string, data: any): Promise<void>;
  close(): Promise<void>;
}

export type TLevelDBOp = {
  type: "put" | "del";
  key: string;
  value?: any;
};

export type TCreateReadStreamOptions = {
  gt?: string;
  gte?: string;
  lt?: string;
  lte?: string;
}

export interface IAtomicDB extends IDB {
  get(key: string): Promise<any>;
  set(key: string, data: any): Promise<void>;
  batch(ops: Array<TLevelDBOp>): Promise<void>;
  createReadStream(options?: TCreateReadStreamOptions): Promise<AsyncIterable<{key: string, value: any}>>;
}
