include "../../../node_modules/circomlib/circuits/babyjub.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/maci-circuits/circom/hasherPoseidon.circom";

include "./ecScalarMul.circom";
include "./pointComputation.circom";

template ProofEqualDiscreteCoordinatesVerifier() {
    signal input version;
    signal input c;
    signal input d0;
    signal input d1;
    signal input g0[2];
    signal input g1[2];
    signal input g2[2];
    signal input y0[2];
    signal input y1[2];
    signal output valid;

    // g0.exp(d0)
    component g0ExpD0 = EcScalarMul(254);
    g0ExpD0.scalar <== d0;
    g0ExpD0.point[0] <== g0[0];
    g0ExpD0.point[1] <== g0[1];

    // y0.exp(c)
    component y0ExpC = EcScalarMul(254);
    y0ExpC.scalar <== c;
    y0ExpC.point[0] <== y0[0];
    y0ExpC.point[1] <== y0[1];

    // first = g0ExpD0.op(y0ExpC)
    component first = BabyAdd();
    first.x1 <== g0ExpD0.res[0];
    first.y1 <== g0ExpD0.res[1];
    first.x2 <== y0ExpC.res[0];
    first.y2 <== y0ExpC.res[1];

    // g1.exp(d0)
    component g1ExpD0 = EcScalarMul(254);
    g1ExpD0.scalar <== d0;
    g1ExpD0.point[0] <== g1[0];
    g1ExpD0.point[1] <== g1[1];

    // g2.exp(d1)
    component g2ExpD1 = EcScalarMul(254);
    g2ExpD1.scalar <== d1;
    g2ExpD1.point[0] <== g2[0];
    g2ExpD1.point[1] <== g2[1];

    // y1.exp(c)
    component y1ExpC = EcScalarMul(254);
    y1ExpC.scalar <== c;
    y1ExpC.point[0] <== y1[0];
    y1ExpC.point[1] <== y1[1];

    // Second: (g1ExpD0.op(g2ExpD1)).op(y1ExpC)
    component temp = BabyAdd();
    temp.x1 <== g1ExpD0.res[0];
    temp.y1 <== g1ExpD0.res[1];
    temp.x2 <== g2ExpD1.res[0];
    temp.y2 <== g2ExpD1.res[1];
    component second = BabyAdd();
    second.x1 <== temp.xout;
    second.y1 <== temp.yout;
    second.x2 <== y1ExpC.res[0];
    second.y2 <== y1ExpC.res[1];

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
