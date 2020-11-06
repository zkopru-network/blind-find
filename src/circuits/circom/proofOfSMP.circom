include "../../../node_modules/circomlib/circuits/gates.circom";
include "./pointEqual.circom";
include "./ecScalarMul.circom";
include "./proofOfDiscreteLogVerifier.circom";
include "./proofEqualDiscreteCoordinatesVerifier.circom";


// Created by H after H runs SMP with A where H is the initiator.
template ProofOfSMP() {
    // TODO: input h's secrets or g2/g3?
    signal private input h2;
    signal private input h3;

    // msg 1
    signal input g2h[2];
    signal input g2hProofC;
    signal input g2hProofD;
    signal input g3h[2];
    signal input g3hProofC;
    signal input g3hProofD;
    signal output tt;
    signal output ts;

    // msg 2
    // signal input g2a[2];
    // signal input g2aProofC;
    // signal input g2aProofD;
    // signal input g3a[2];
    // signal input g3aProofC;
    // signal input g3aProofD;
    // signal input pa;
    // signal input qa;
    // signal input paqaProofC;
    // signal input paqaProofD0;
    // signal input paqaProofD1;

    // // msg 3
    // signal input ph;
    // signal input qh;
    // signal input phqhProofC;
    // signal input phqhProofD0;
    // signal input phqhProofD1;
    // signal input rh;
    // signal input rhProofC;
    // signal input rhProofD;

    // signal g2;
    // signal g3;

    signal output valid;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    /* msg 1 */

    // Ensure `g ** a2 == g2a` and `g ** a3 == g3a`
    component g2hCalc = EcScalarMul(254);
    g2hCalc.scalar <== h2;
    g2hCalc.point[0] <== BASE8[0];
    g2hCalc.point[1] <== BASE8[1];
    component g2hCorrect = PointEqual();
    g2hCorrect.pointA[0] <== g2h[0];
    g2hCorrect.pointA[1] <== g2h[1];
    g2hCorrect.pointB[0] <== g2hCalc.res[0];
    g2hCorrect.pointB[1] <== g2hCalc.res[1];
    g2hCorrect.out === 1;

    component g3hCalc = EcScalarMul(254);
    g3hCalc.scalar <== h3;
    g3hCalc.point[0] <== BASE8[0];
    g3hCalc.point[1] <== BASE8[1];
    component g3hCorrect = PointEqual();
    g3hCorrect.pointA[0] <== g3h[0];
    g3hCorrect.pointA[1] <== g3h[1];
    g3hCorrect.pointB[0] <== g3hCalc.res[0];
    g3hCorrect.pointB[1] <== g3hCalc.res[1];
    g3hCorrect.out === 1;

    component g2hProofDL = ProofOfDiscreteLogVerifier();
    g2hProofDL.version <== 1;
    g2hProofDL.c <== g2hProofC;
    g2hProofDL.d <== g2hProofD;
    g2hProofDL.g[0] <== BASE8[0];
    g2hProofDL.g[1] <== BASE8[1];
    g2hProofDL.y[0] <== g2h[0];
    g2hProofDL.y[1] <== g2h[1];
    g2hProofDL.valid === 1;
    tt <== g2hProofDL.valid;

    component g3hProofDL = ProofOfDiscreteLogVerifier();
    g3hProofDL.version <== 2;
    g3hProofDL.c <== g3hProofC;
    g3hProofDL.d <== g3hProofD;
    g3hProofDL.g[0] <== BASE8[0];
    g3hProofDL.g[1] <== BASE8[1];
    g3hProofDL.y[0] <== g3h[0];
    g3hProofDL.y[1] <== g3h[1];
    g3hProofDL.valid === 1;
    ts <== g3hProofDL.valid;

    component msg1Valid = MultiAND(2);
    // msg1Valid.in[0] <== g2aCorrect.out;
    // msg1Valid.in[1] <== g3hCorrect.out;
    msg1Valid.in[0] <== g2hProofDL.valid;
    msg1Valid.in[1] <== g3hProofDL.valid;

    /* msg 2 */

    // component g2aProofDL = ProofOfDiscreteLogVerifier();
    // g2aProofDL.version <== 3;
    // g2aProofDL.c <== g2aProofC;
    // g2aProofDL.d <== g2aProofD;
    // g2aProofDL.g[0] <== BASE8[0];
    // g2aProofDL.g[1] <== BASE8[1];
    // g2aProofDL.y[0] <== g2a[0];
    // g2aProofDL.y[1] <== g2a[1];

    // component g3aProofDL = ProofOfDiscreteLogVerifier();
    // g3aProofDL.version <== 4;
    // g3aProofDL.c <== g3aProofC;
    // g3aProofDL.d <== g3aProofD;
    // g3aProofDL.g[0] <== BASE8[0];
    // g3aProofDL.g[1] <== BASE8[1];
    // g3aProofDL.y[0] <== g3a[0];
    // g3aProofDL.y[1] <== g3a[1];

    // component paqqProofVerifier = ProofEqualDiscreteCoordinatesVerifier();
    // paqqProofVerifier.version <== 5;
    // paqqProofVerifier.c <== paqaProofC;
    // paqqProofVerifier.d0 <== paqaProofD0;
    // paqqProofVerifier.d1 <== paqaProofD1;
    // paqqProofVerifier.g0[0] <== g2


    component res = MultiAND(1);
    res.in[0] <== msg1Valid.out;
    // res[1] <=

    valid <== res.out;
}
