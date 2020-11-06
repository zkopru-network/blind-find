include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/gates.circom";

template PointEqual() {
    signal input pointA[2];
    signal input pointB[2];
    signal output out;

    component xEqual = IsEqual();
    xEqual.in[0] <== pointA[0];
    xEqual.in[1] <== pointB[0];

    component yEqual = IsEqual();
    yEqual.in[0] <== pointA[1];
    yEqual.in[1] <== pointB[1];

    component res = AND();
    res.a <== xEqual.out;
    res.b <== yEqual.out;
    out <== res.out;
}
