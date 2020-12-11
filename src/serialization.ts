import { PubKey, Signature } from 'maci-crypto';
import { LEVELS } from './configs';
import { ValueError } from './smp/exceptions';
import { BaseFixedInt, BaseSerializable } from './smp/serialization';
import { concatUint8Array } from './smp/utils';
import { Point, Scalar } from './smp/v4/serialization';


enum RPCType {
    GetMerkleProofReq = 6,
    GetMerkleProofResp,
}

function serializeElements(
    values: BaseSerializable[],
): Uint8Array {
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
    wireTypes: TSerializable[],
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
        Point,  // hubPubkey,
        Point, Scalar,  // hubSig
        Point, Scalar,  // adminSig
    ];

    constructor(
        readonly hubPubkey: PubKey,
        readonly hubSig: Signature,
        readonly adminSig: Signature,
    ) {
        super();
    }

    static deserialize(b: Uint8Array): GetMerkleProofReq {
        return super.deserialize(b) as GetMerkleProofReq;
    }

    static consume(b: Uint8Array): [GetMerkleProofReq, Uint8Array] {
        const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
        return [new GetMerkleProofReq(
            (elements[0] as Point).point,
            {R8: (elements[1] as Point).point, S: (elements[2] as BaseFixedInt).value},
            {R8: (elements[3] as Point).point, S: (elements[4] as BaseFixedInt).value},
        ), bytesRemaining];
    }

    serialize(): Uint8Array {
        return serializeElements([
            new Point(this.hubPubkey),
            new Point(this.hubSig.R8), new Scalar(this.hubSig.S),
            new Point(this.adminSig.R8), new Scalar(this.adminSig.S),
        ]);
    }
}


const merklePathWireType: (typeof BaseFixedInt)[] = [];
for (let i = 0; i < LEVELS; i++) {
    merklePathWireType.push(Scalar);
}

class MerklePath extends BaseSerializable {
    static wireTypes = merklePathWireType;

    constructor(readonly merklePath: BigInt[]) {
        super();
        if (merklePath.length !== LEVELS) {
            throw new ValueError(
                `incorrect levels: expected=${LEVELS}, actual=${merklePath.length}`
            );
        }
    }

    static deserialize(b: Uint8Array): MerklePath {
        return super.deserialize(b) as MerklePath;
    }

    static consume(b: Uint8Array): [MerklePath, Uint8Array] {
        const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
        const res = elements.map(x => (x as BaseFixedInt).value);
        return [new MerklePath(res), bytesRemaining];
    }

    serialize(): Uint8Array {
        const wireValues = this.merklePath.map(x => new Scalar(x));
        return serializeElements(wireValues);
    }
}

export class GetMerkleProofResp extends BaseSerializable {
    static wireTypes = [
        Scalar,  // merkleRoot,
        MerklePath,  // merklePath
    ];

    constructor(
        readonly merkleRoot: BigInt,
        readonly merklePath: BigInt[],
    ) {
        super();
    }

    static deserialize(b: Uint8Array): GetMerkleProofResp {
        return super.deserialize(b) as GetMerkleProofResp;
    }

    static consume(b: Uint8Array): [GetMerkleProofResp, Uint8Array] {
        const [elements, bytesRemaining] = deserializeElements(b, this.wireTypes);
        return [new GetMerkleProofResp(
            (elements[0] as BaseFixedInt).value,
            (elements[1] as MerklePath).merklePath,
        ), bytesRemaining];
    }

    serialize(): Uint8Array {
        return serializeElements([
            new Scalar(this.merkleRoot),
            new MerklePath(this.merklePath),
        ]);
    }
}
