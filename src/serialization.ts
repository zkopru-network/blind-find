import {
  PubKey,
  Signature,
  stringifyBigInts,
  unstringifyBigInts
} from "maci-crypto";
import { TProof } from "./circuits";
import { LEVELS } from "./configs";
import { MerkleProof } from "./interfaces";
import { ValueError } from "./smp/exceptions";
import {
  BaseFixedInt,
  BaseSerializable,
  Byte,
  Short,
  TLV
} from "./smp/serialization";
import { bigIntToNumber, concatUint8Array } from "./smp/utils";
import { Point, Scalar } from "./smp/v4/serialization";

export enum msgType {
  JoinReq = 6,
  SearchReq,
  JSONObj,
}

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
  // Used `TSerializable[]` because `(typeof BaseSerializable)[]` doesn't work.
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
    Scalar // hubSig
  ];

  constructor(readonly hubPubkey: PubKey, readonly hubSig: Signature) {
    super();
  }

  static deserialize(b: Uint8Array): GetMerkleProofReq {
    return super.deserialize(b) as GetMerkleProofReq;
  }

  static consume(b: Uint8Array): [GetMerkleProofReq, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    return [
      new GetMerkleProofReq((elements[0] as Point).point, {
        R8: (elements[1] as Point).point,
        S: (elements[2] as BaseFixedInt).value
      }),
      bytesRemaining
    ];
  }

  serialize(): Uint8Array {
    return serializeElements([
      new Point(this.hubPubkey),
      new Point(this.hubSig.R8),
      new Scalar(this.hubSig.S)
    ]);
  }
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

export class JoinReq extends BaseSerializable {
  static wireTypes = [
    Point, // userPubkey,
    Point,
    Scalar // userSig
  ];

  constructor(readonly userPubkey: PubKey, readonly userSig: Signature) {
    super();
  }

  static deserialize(b: Uint8Array): JoinReq {
    return super.deserialize(b) as JoinReq;
  }

  static consume(b: Uint8Array): [JoinReq, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    return [
      new JoinReq((elements[0] as Point).point, {
        R8: (elements[1] as Point).point,
        S: (elements[2] as BaseFixedInt).value
      }),
      bytesRemaining
    ];
  }

  serialize(): Uint8Array {
    return serializeElements([
      new Point(this.userPubkey),
      new Point(this.userSig.R8),
      new Scalar(this.userSig.S)
    ]);
  }
}

export class JoinResp extends BaseSerializable {
  static wireTypes = [
    Point,
    Scalar // hubSig
  ];

  constructor(readonly hubSig: Signature) {
    super();
  }

  static deserialize(b: Uint8Array): JoinResp {
    return super.deserialize(b) as JoinResp;
  }

  static consume(b: Uint8Array): [JoinResp, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    return [
      new JoinResp({
        R8: (elements[0] as Point).point,
        S: (elements[1] as BaseFixedInt).value
      }),
      bytesRemaining
    ];
  }

  serialize(): Uint8Array {
    return serializeElements([
      new Point(this.hubSig.R8),
      new Scalar(this.hubSig.S)
    ]);
  }
}

class EmptyMessage extends BaseSerializable {
  static wireTypes = [];

  static deserialize(b: Uint8Array): EmptyMessage {
    return super.deserialize(b) as EmptyMessage;
  }

  static consume(b: Uint8Array): [EmptyMessage, Uint8Array] {
    return [new EmptyMessage(), b];
  }

  serialize(): Uint8Array {
    return new Uint8Array();
  }
}

export class RequestSearchMessage extends EmptyMessage {
  static deserialize(b: Uint8Array): RequestSearchMessage {
    return super.deserialize(b) as RequestSearchMessage;
  }

  static consume(b: Uint8Array): [RequestSearchMessage, Uint8Array] {
    return super.consume(b) as [RequestSearchMessage, Uint8Array];
  }

  serialize(): Uint8Array {
    return super.serialize();
  }
}

export const SEARCH_MSG_0_IS_NOT_END = BigInt(0);
export const SEARCH_MSG_0_IS_END = BigInt(1);

// isEnd
export class SearchMessage0 extends Byte {}

// smpMsg1
export class SearchMessage1 extends TLV {}

// smpMsg2
export class SearchMessage2 extends TLV {}

class JSONObj extends BaseSerializable {
  constructor(readonly jsonObj: any) {
    super();
  }

  static deserialize(b: Uint8Array): JSONObj {
    return super.deserialize(b) as JSONObj;
  }

  static consume(b: Uint8Array): [JSONObj, Uint8Array] {
    const [tlv, bytesRemaining] = TLV.consume(b);
    const objString = Buffer.from(tlv.value).toString("utf-8");
    const obj = JSON.parse(objString);
    return [new JSONObj(obj), bytesRemaining];
  }

  serialize(): Uint8Array {
    const objString = JSON.stringify(this.jsonObj);
    const bytes = Buffer.from(objString, "utf-8");
    return new TLV(new Short(msgType.JSONObj), bytes).serialize();
  }
}

export class SearchMessage3 extends BaseSerializable {
  static wireTypes = [
    TLV, // smpMsg3
    JSONObj, // Proof of SMP: proof.proof
    JSONObj // Proof of SMP: proof.publicSignals
  ];
  constructor(readonly smpMsg3: TLV, readonly proof: TProof) {
    super();
  }

  static deserialize(b: Uint8Array): SearchMessage3 {
    return super.deserialize(b) as SearchMessage3;
  }

  static consume(b: Uint8Array): [SearchMessage3, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    const smpMsg3 = elements[0] as TLV;
    const proof = unstringifyBigInts((elements[1] as JSONObj).jsonObj);
    const publicSignals = unstringifyBigInts((elements[2] as JSONObj).jsonObj);
    return [
      new SearchMessage3(smpMsg3, {
        proof: proof,
        publicSignals: publicSignals
      }),
      bytesRemaining
    ];
  }

  serialize(): Uint8Array {
    return serializeElements([
      this.smpMsg3,
      new JSONObj(stringifyBigInts(this.proof.proof)),
      new JSONObj(stringifyBigInts(this.proof.publicSignals))
    ]);
  }
}

export class ProofSaltedConnectionReq extends BaseSerializable {
  // Proof of Salted Connection

  static wireTypes = [
    JSONObj, // proof.proof
    JSONObj // proof.publicSignals
  ];

  constructor(readonly proof: TProof) {
    super();
  }

  static deserialize(b: Uint8Array): ProofSaltedConnectionReq {
    return super.deserialize(b) as ProofSaltedConnectionReq;
  }

  static consume(b: Uint8Array): [ProofSaltedConnectionReq, Uint8Array] {
    const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
    const proof = unstringifyBigInts((elements[0] as JSONObj).jsonObj);
    const publicSignals = unstringifyBigInts((elements[1] as JSONObj).jsonObj);
    return [
      new ProofSaltedConnectionReq({
        proof: proof,
        publicSignals: publicSignals
      }),
      bytesRemaining
    ];
  }

  serialize(): Uint8Array {
    return serializeElements([
      new JSONObj(stringifyBigInts(this.proof.proof)),
      new JSONObj(stringifyBigInts(this.proof.publicSignals))
    ]);
  }
}


export const PROOF_SALTED_CONNECTION_RESP_REJECT = BigInt(0);
export const PROOF_SALTED_CONNECTION_RESP_ACCEPT = BigInt(1);

export class ProofSaltedConnectionResp extends Byte {

}
