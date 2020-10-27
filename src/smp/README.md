# SMP with Baby Jubjub and Poseidon

This directory contains the code copied from [js-smp][js-smp]. It is modified to use [Baby Jubjub][baby-jubjub] curve with [Poseidon][poseidon], which work efficiently in zk-snark. To make this change easier, we follow [OTR version 4 spec][otr-spec-v4] instead of [OTR version 3 spec][otr-spec-v3] because v4 also uses ECC.

Even though OTR version 4 is obeyed as much as possible, this SMP implementation is expected unable to talk with the other implementations which obey OTR v4 spec because we have the following changes: 

- Group
    - The original multiplicative group is replaced by the subgroup on Baby Jubjub points, instead of Ed448 points in version 4 spec.
- Serialization
    - [`Point` and `Scalar`](https://github.com/otrv4/otrv4/blob/master/otrv4.md#data-types) are added. Unlike other data types, they are serialized in little-endian order, which conforms to [RFC 8032][rfc-8032].
    - `Point` is 32 bytes instead of 57 bytes. 32 bytes is enough to contain a Baby Jubjub point.
    - `Scalar` is 32 bytes instead of 57 bytes. 32 bytes is enough to contain a scalar field.
- Hash function
    - SHA256 is replaced by Poseidon, instead of SHAKE-256 in version 4 spec.
    - Arguments are transformed from `Point` to `Scalar` and directly passed to Poseidon respectively instead of being concatenated as a single argument. When transforming a `Point` to `Scalar`, the point is serialized to its binary representation and interpretted as a `Scalar` in little-endian order.
- Message
    - SMP Message 1: the field `Question (DATA)` is removed.


[otr-spec-v3]: https://otr.cypherpunks.ca/Protocol-v3-4.0.0.html
[otr-spec-v4]: https://github.com/otrv4/otrv4/blob/master/otrv4.md#socialist-millionaires-protocol-smp
[js-smp]: https://github.com/mhchia/js-smp
[poseidon]: https://www.poseidon-hash.info/
[baby-jubjub]: https://github.com/barryWhiteHat/baby_jubjub_ecc
[rfc-8032]: https://tools.ietf.org/html/rfc8032
