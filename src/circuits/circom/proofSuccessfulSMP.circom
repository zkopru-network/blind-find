include "../../../node_modules/maci-circuits/circom/hasherPoseidon.circom";
include "../../../node_modules/maci-circuits/circom/verify_signature.circom";

include "./pointOperations.circom";

// Created by A after H runs SMP with A where H is the initiator.
template ProofSuccessfulSMP() {
    // TODO: Check if points are on the currect subgroup.
    signal private input a3;
    signal private input sigRhR8[2];
    signal private input sigRhS;

    signal input pubkeyA[2];
    // msg 2
    signal input pa[2];
    // msg 3
    signal input ph[2];
    signal input rh[2];

    signal output valid;

    component hasher = Hasher5();
    hasher.in[0] <== rh[0];
    hasher.in[1] <== rh[1];
    hasher.in[2] <== 0;
    hasher.in[3] <== 0;
    hasher.in[4] <== 0;

    component sigVerifier = EdDSAPoseidonVerifier_patched();
    sigVerifier.Ax <== pubkeyA[0];
    sigVerifier.Ay <== pubkeyA[1];
    sigVerifier.R8x <== sigRhR8[0];
    sigVerifier.R8y <== sigRhR8[1];
    sigVerifier.S <== sigRhS;
    sigVerifier.M <== hasher.hash;
    sigVerifier.valid === 1;

    // left = (Rh * a3)
    component left = BabyMulScalar(254);
    left.scalar <== a3;
    left.point[0] <== rh[0];
    left.point[1] <== rh[1];

    // right = (Ph - Pa)
    component paInverse = BabyInverse();
    paInverse.point[0] <== pa[0];
    paInverse.point[1] <== pa[1];
    component right = BabyAdd();
    right.x1 <== ph[0];
    right.y1 <== ph[1];
    right.x2 <== paInverse.out[0];
    right.y2 <== paInverse.out[1];

    // Check `left == right`, i.e. `(Rh * a3) == (Ph - Pa)`.
    component leftEqualRight = IsPointEqual();
    leftEqualRight.pointA[0] <== left.out[0];
    leftEqualRight.pointA[1] <== left.out[1];
    leftEqualRight.pointB[0] <== right.xout;
    leftEqualRight.pointB[1] <== right.yout;
    leftEqualRight.out === 1;

    valid <== leftEqualRight.out;
}
