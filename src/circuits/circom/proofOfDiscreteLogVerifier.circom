include "../../../node_modules/circomlib/circuits/babyjub.circom";
include "../../../node_modules/maci-circuits/circom/hasherPoseidon.circom";

include "./ecScalarMul.circom";
include "./pointComputation.circom";

template ProofOfDiscreteLogVerifier() {
    signal input version;
    signal input c;
    signal input d;
    signal input g[2];
    signal input y[2];
    signal output valid;

    component yExpC = EcScalarMul(254);
    yExpC.scalar <== c;
    yExpC.point[0] <== y[0];
    yExpC.point[1] <== y[1];

    component gExpD = EcScalarMul(254);
    gExpD.scalar <== d;
    gExpD.point[0] <== g[0];
    gExpD.point[1] <== g[1];

    component op = BabyAdd();
    op.x1 <== yExpC.res[0];
    op.y1 <== yExpC.res[1];
    op.x2 <== gExpD.res[0];
    op.y2 <== gExpD.res[1];

    component hasher = Hasher5();
    hasher.in[0] <== version;
    hasher.in[1] <== op.xout;
    hasher.in[2] <== op.yout;
    hasher.in[3] <== 0;
    hasher.in[4] <== 0;

    component equal = IsEqual();
    equal.in[0] <== hasher.hash;
    equal.in[1] <== c;
    valid <== equal.out;
}
