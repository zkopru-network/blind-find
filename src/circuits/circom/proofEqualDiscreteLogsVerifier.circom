include "../../../node_modules/circomlib/circuits/babyjub.circom";
include "../../../node_modules/maci-circuits/circom/hasherPoseidon.circom";

include "./pointComputation.circom";
include "./pointComputation.circom";

template ProofEqualDiscreteLogsVerifier() {
    signal input version;
    signal input c;
    signal input d;
    signal input g0[2];
    signal input g1[2];
    signal input y0[2];
    signal input y1[2];
    signal output valid;

    // g0.exp(d)
    component g0ExpD = BabyMulScalar(254);
    g0ExpD.scalar <== d;
    g0ExpD.point[0] <== g0[0];
    g0ExpD.point[1] <== g0[1];

    // y0.exp(c)
    component y0ExpC = BabyMulScalar(254);
    y0ExpC.scalar <== c;
    y0ExpC.point[0] <== y0[0];
    y0ExpC.point[1] <== y0[1];

    // first = g0ExpD.op(y0ExpC)
    component first = BabyAdd();
    first.x1 <== g0ExpD.out[0];
    first.y1 <== g0ExpD.out[1];
    first.x2 <== y0ExpC.out[0];
    first.y2 <== y0ExpC.out[1];

    // g1.exp(d)
    component g1ExpD = BabyMulScalar(254);
    g1ExpD.scalar <== d;
    g1ExpD.point[0] <== g1[0];
    g1ExpD.point[1] <== g1[1];

    // y1.exp(c)
    component y1ExpC = BabyMulScalar(254);
    y1ExpC.scalar <== c;
    y1ExpC.point[0] <== y1[0];
    y1ExpC.point[1] <== y1[1];

    // Second: g1ExpD.op(y1ExpC)
    component second = BabyAdd();
    second.x1 <== g1ExpD.out[0];
    second.y1 <== g1ExpD.out[1];
    second.x2 <== y1ExpC.out[0];
    second.y2 <== y1ExpC.out[1];

    component hasher = Hasher5();
    hasher.in[0] <== version;
    hasher.in[1] <== first.xout;
    hasher.in[2] <== first.yout;
    hasher.in[3] <== second.xout;
    hasher.in[4] <== second.yout;

    component equal = IsEqual();
    equal.in[0] <== hasher.hash;
    equal.in[1] <== c;
    valid <== equal.out;
}
