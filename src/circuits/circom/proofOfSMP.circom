include "../../../node_modules/circomlib/circuits/gates.circom";

include "./ecScalarMul.circom";
include "./pointComputation.circom"
include "./pointEqual.circom";
include "./proofOfDiscreteLogVerifier.circom";
include "./proofEqualDiscreteCoordinatesVerifier.circom";
include "./proofEqualDiscreteLogsVerifier.circom"


// Created by H after H runs SMP with A where H is the initiator.
template ProofOfSMP() {
    // TODO: Add check for points
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

    // msg 2
    signal input g2a[2];
    signal input g2aProofC;
    signal input g2aProofD;
    signal input g3a[2];
    signal input g3aProofC;
    signal input g3aProofD;
    signal input pa[2];
    signal input qa[2];
    signal input paqaProofC;
    signal input paqaProofD0;
    signal input paqaProofD1;

    // msg 3
    signal input ph[2];
    signal input qh[2];
    signal input phqhProofC;
    signal input phqhProofD0;
    signal input phqhProofD1;
    signal input rh[2];
    signal input rhProofC;
    signal input rhProofD;

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

    // Ensure the Proof of Discrete Logs of `g2h` and `g3h` are correct.
    component g2hProofDL = ProofOfDiscreteLogVerifier();
    g2hProofDL.version <== 1;
    g2hProofDL.c <== g2hProofC;
    g2hProofDL.d <== g2hProofD;
    g2hProofDL.g[0] <== BASE8[0];
    g2hProofDL.g[1] <== BASE8[1];
    g2hProofDL.y[0] <== g2h[0];
    g2hProofDL.y[1] <== g2h[1];
    g2hProofDL.valid === 1;

    component g3hProofDL = ProofOfDiscreteLogVerifier();
    g3hProofDL.version <== 2;
    g3hProofDL.c <== g3hProofC;
    g3hProofDL.d <== g3hProofD;
    g3hProofDL.g[0] <== BASE8[0];
    g3hProofDL.g[1] <== BASE8[1];
    g3hProofDL.y[0] <== g3h[0];
    g3hProofDL.y[1] <== g3h[1];
    g3hProofDL.valid === 1;

    component msg1Valid = MultiAND(4);
    msg1Valid.in[0] <== g2hCorrect.out;
    msg1Valid.in[1] <== g3hCorrect.out;
    msg1Valid.in[2] <== g2hProofDL.valid;
    msg1Valid.in[3] <== g3hProofDL.valid;

    /* msg 2 */

    component g2aProofDL = ProofOfDiscreteLogVerifier();
    g2aProofDL.version <== 3;
    g2aProofDL.c <== g2aProofC;
    g2aProofDL.d <== g2aProofD;
    g2aProofDL.g[0] <== BASE8[0];
    g2aProofDL.g[1] <== BASE8[1];
    g2aProofDL.y[0] <== g2a[0];
    g2aProofDL.y[1] <== g2a[1];
    g2aProofDL.valid === 1;

    component g3aProofDL = ProofOfDiscreteLogVerifier();
    g3aProofDL.version <== 4;
    g3aProofDL.c <== g3aProofC;
    g3aProofDL.d <== g3aProofD;
    g3aProofDL.g[0] <== BASE8[0];
    g3aProofDL.g[1] <== BASE8[1];
    g3aProofDL.y[0] <== g3a[0];
    g3aProofDL.y[1] <== g3a[1];
    g3aProofDL.valid === 1;

    // Calculate `g2` and `g3`.
    component g2 = EcScalarMul(254);
    g2.scalar <== h2;
    g2.point[0] <== g2a[0];
    g2.point[1] <== g2a[1];
    component g3 = EcScalarMul(254);
    g3.scalar <== h3;
    g3.point[0] <== g3a[0];
    g3.point[1] <== g3a[1];

    // Verify `Pa` and `Qa`, with the given inputs and the calculated `g2` and `g3`.
    component paqaProofVerifier = ProofEqualDiscreteCoordinatesVerifier();
    paqaProofVerifier.version <== 5;
    paqaProofVerifier.c <== paqaProofC;
    paqaProofVerifier.d0 <== paqaProofD0;
    paqaProofVerifier.d1 <== paqaProofD1;
    paqaProofVerifier.g0[0] <== g3.res[0];
    paqaProofVerifier.g0[1] <== g3.res[1];
    paqaProofVerifier.g1[0] <== BASE8[0];
    paqaProofVerifier.g1[1] <== BASE8[1];
    paqaProofVerifier.g2[0] <== g2.res[0];
    paqaProofVerifier.g2[1] <== g2.res[1];
    paqaProofVerifier.y0[0] <== pa[0];
    paqaProofVerifier.y0[1] <== pa[1];
    paqaProofVerifier.y1[0] <== qa[0];
    paqaProofVerifier.y1[1] <== qa[1];
    paqaProofVerifier.valid === 1;

    component msg2Valid = MultiAND(3);
    msg2Valid.in[0] <== g2aProofDL.valid;
    msg2Valid.in[1] <== g3aProofDL.valid;
    msg2Valid.in[2] <== paqaProofVerifier.valid;

    /* msg 3 */

    // Verify `Ph` and `Qh`, with the given inputs and the calculated `g2` and `g3`.
    component phqhProofVerifier = ProofEqualDiscreteCoordinatesVerifier();
    phqhProofVerifier.version <== 6;
    phqhProofVerifier.c <== phqhProofC;
    phqhProofVerifier.d0 <== phqhProofD0;
    phqhProofVerifier.d1 <== phqhProofD1;
    phqhProofVerifier.g0[0] <== g3.res[0];
    phqhProofVerifier.g0[1] <== g3.res[1];
    phqhProofVerifier.g1[0] <== BASE8[0];
    phqhProofVerifier.g1[1] <== BASE8[1];
    phqhProofVerifier.g2[0] <== g2.res[0];
    phqhProofVerifier.g2[1] <== g2.res[1];
    phqhProofVerifier.y0[0] <== ph[0];
    phqhProofVerifier.y0[1] <== ph[1];
    phqhProofVerifier.y1[0] <== qh[0];
    phqhProofVerifier.y1[1] <== qh[1];
    phqhProofVerifier.valid === 1;

    // Compute qh/qa;
    component qaInverse = BabyInverse();
    qaInverse.point[0] <== qa[0];
    qaInverse.point[1] <== qa[1];
    component qhOverQa = BabyAdd();
    qhOverQa.x1 <== qh[0];
    qhOverQa.y1 <== qh[1];
    qhOverQa.x2 <== qaInverse.pointInverse[0];
    qhOverQa.y2 <== qaInverse.pointInverse[1];

    // Verify Rh
    component rhProofVerifier = ProofEqualDiscreteLogsVerifier();
    rhProofVerifier.version <== 7;
    rhProofVerifier.c <== rhProofC;
    rhProofVerifier.d <== rhProofD;
    rhProofVerifier.g0[0] <== BASE8[0];
    rhProofVerifier.g0[1] <== BASE8[1];
    rhProofVerifier.g1[0] <== qhOverQa.xout;
    rhProofVerifier.g1[1] <== qhOverQa.yout;
    rhProofVerifier.y0[0] <== g3h[0];
    rhProofVerifier.y0[1] <== g3h[1];
    rhProofVerifier.y1[0] <== rh[0];
    rhProofVerifier.y1[1] <== rh[1];
    rhProofVerifier.valid === 1;

    component msg3Valid = MultiAND(2);
    msg3Valid.in[0] <== phqhProofVerifier.valid;
    msg3Valid.in[1] <== rhProofVerifier.valid;

    component res = MultiAND(3);
    res.in[0] <== msg1Valid.out;
    res.in[1] <== msg2Valid.out;
    res.in[2] <== msg3Valid.out;

    valid <== res.out;
}
