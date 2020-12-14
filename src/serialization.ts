import { PubKey, Signature } from "maci-crypto";
import { LEVELS } from "./configs";
import { ValueError } from "./smp/exceptions";
import { BaseFixedInt, BaseSerializable } from "./smp/serialization";
import { bigIntToNumber, concatUint8Array } from "./smp/utils";
import { Point, Scalar } from "./smp/v4/serialization";

// TODO: Add RPC types back when we need several RPC in a single server. E.g. a hub
//  has RPC `join` and `search`.
// enum RPCType {
//   GetMerkleProofReq = 6,
//   GetMerkleProofResp
// }

function serializeElements(values: BaseSerializable[]): Uint8Array {
  let bytes = new Uint8Array([]);
  for (const value of values) {
    bytes = concatUint8Array(bytes, value.serialize());
  }
  return bytes;
}

interface TSerializable {
  consume(_: Uint8Array): [BaseSerializable, Uint8Array];
}

function deserializeElements(
  bytes: Uint8Array,
  wireTypes: TSerializable[]
): [BaseSerializable[], Uint8Array] {
  const res: BaseSerializable[] = [];
  let element: BaseSerializable;
  let bytesRemaining = bytes;
  for (const t of wireTypes) {
    [element, bytesRemaining] = t.consume(bytesRemaining);
    res.push(element);
  }
  return [res, bytesRemaining];
}

export class GetMerkleProofReq extends BaseSerializable {
  static wireTypes = [
    Point, // hubPubkey,
    Point,
    Scalar, // hubSig
    Point,
    Scalar // adminSig
  ];

  constructor(
    readonly hubPubkey: PubKey,
    readonly hubSig: Signature,
    readonly adminSig: Signature
  ) {
    super();
  }

  static deserialize(b: Uint8Array): GetMerkleProofReq {
    return super.deserialize(b) as GetMerkleProofReq;
  }

  static consume(b: Uint8Array): [GetMerkleProofReq, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    return [
      new GetMerkleProofReq(
        (elements[0] as Point).point,
        {
          R8: (elements[1] as Point).point,
          S: (elements[2] as BaseFixedInt).value
        },
        {
          R8: (elements[3] as Point).point,
          S: (elements[4] as BaseFixedInt).value
        }
      ),
      bytesRemaining
    ];
  }

  serialize(): Uint8Array {
    return serializeElements([
      new Point(this.hubPubkey),
      new Point(this.hubSig.R8),
      new Scalar(this.hubSig.S),
      new Point(this.adminSig.R8),
      new Scalar(this.adminSig.S)
    ]);
  }
}

interface MerkleProof {
  pathElements: BigInt[][];
  indices: number[]; // 2 ** 53
  depth: number;
  root: BigInt;
  leaf: BigInt;
}

const merklePathWireType: typeof BaseFixedInt[] = [];
const merkleIndicesWireType: typeof BaseFixedInt[] = [];
for (let i = 0; i < LEVELS; i++) {
  merklePathWireType.push(Scalar);
  merkleIndicesWireType.push(Scalar);
}

class MerkleProofWire extends BaseSerializable {
  static wireTypes: typeof BaseFixedInt[] = [
    ...merklePathWireType,
    ...merkleIndicesWireType,
    Scalar, // Depth. Use `BigInt` just for convenient. It can be changed to 8-byte element.
    Scalar, // Root
    Scalar // Leaf
  ];

  // NOTE: It should be a one-dimension array.
  //  Just be consistent with maci-crpyto.
  constructor(readonly merkleProof: MerkleProof) {
    super();
    if (merkleProof.depth !== LEVELS) {
      throw new ValueError(
        `incorrect depth: expected=${LEVELS}, actual=${merkleProof.depth}`
      );
    }
    if (
      merkleProof.pathElements.length !== LEVELS ||
      merkleProof.indices.length !== LEVELS
    ) {
      throw new ValueError(
        `incorrect path levels: expected=${LEVELS}, ` +
          `merkleProof.pathElements.length=${merkleProof.pathElements.length}, ` +
          `merkleProof.indices.length=${merkleProof.indices.length}`
      );
    }
  }

  static deserialize(b: Uint8Array): MerkleProofWire {
    return super.deserialize(b) as MerkleProofWire;
  }

  static consume(b: Uint8Array): [MerkleProofWire, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    const bigInts = elements.map(x => (x as BaseFixedInt).value);
    const pathElements = bigInts
      .slice(0, merklePathWireType.length)
      .map(x => [x]);
    const indices = bigInts
      .slice(
        merklePathWireType.length,
        merklePathWireType.length + merkleIndicesWireType.length
      )
      .map(x => bigIntToNumber(x));
    const proof = {
      pathElements: pathElements,
      indices: indices,
      depth: bigIntToNumber(
        bigInts[merklePathWireType.length + merklePathWireType.length]
      ),
      root: bigInts[merklePathWireType.length + merklePathWireType.length + 1],
      leaf: bigInts[merklePathWireType.length + merklePathWireType.length + 2]
    };
    return [new MerkleProofWire(proof), bytesRemaining];
  }

  serialize(): Uint8Array {
    return serializeElements([
      ...this.merkleProof.pathElements.map(x => new Scalar(x[0])),
      ...this.merkleProof.indices.map(x => new Scalar(x)),
      new Scalar(this.merkleProof.depth),
      new Scalar(this.merkleProof.root),
      new Scalar(this.merkleProof.leaf)
    ]);
  }
}

export class GetMerkleProofResp extends MerkleProofWire {}
