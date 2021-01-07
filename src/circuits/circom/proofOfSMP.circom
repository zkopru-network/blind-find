include "../../../node_modules/maci-circuits/circom/trees/incrementalMerkleTree.circom";
include "../../../node_modules/circomlib/circuits/gates.circom";
include "../../../node_modules/maci-circuits/circom/hasherPoseidon.circom";
include "../../../node_modules/maci-circuits/circom/verify_signature.circom";

include "./pointOperations.circom";
include "./proofOfDiscreteLogVerifier.circom";
include "./proofEqualDiscreteCoordinatesVerifier.circom";
include "./proofEqualDiscreteLogsVerifier.circom"


template CounterSigHash() {
    signal input sigR8[2];
    signal input sigS;
    signal output out;

    component hasher = Hasher5();
    hasher.in[0] <== sigR8[0];
    hasher.in[1] <== sigR8[1];
    hasher.in[2] <== sigS;
    hasher.in[3] <== 0;
    hasher.in[4] <== 0;

    out <== hasher.hash;
}

template CounterSignedSigsVerifier() {
    signal input hashedData;
    signal input pubkey[2];
    signal input sigR8[2];
    signal input sigS;
    signal input counterSignedPubkey[2];
    signal input counterSignedSigR8[2];
    signal input counterSignedSigS;

    signal output valid;

    component sigVerifier = EdDSAPoseidonVerifier_patched();
    sigVerifier.Ax <== pubkey[0];
    sigVerifier.Ay <== pubkey[1];
    sigVerifier.R8x <== sigR8[0];
    sigVerifier.R8y <== sigR8[1];
    sigVerifier.S <== sigS;
    sigVerifier.M <== hashedData;

    component counterSigHash = CounterSigHash();
    counterSigHash.sigR8[0] <== sigR8[0];
    counterSigHash.sigR8[1] <== sigR8[1];
    counterSigHash.sigS <== sigS;

    component counterSignedSigVerifier = EdDSAPoseidonVerifier_patched();
    counterSignedSigVerifier.Ax <== counterSignedPubkey[0];
    counterSignedSigVerifier.Ay <== counterSignedPubkey[1];
    counterSignedSigVerifier.R8x <== counterSignedSigR8[0];
    counterSignedSigVerifier.R8y <== counterSignedSigR8[1];
    counterSignedSigVerifier.S <== counterSignedSigS;
    counterSignedSigVerifier.M <== counterSigHash.out;

    component res = AND();
    res.a <== sigVerifier.valid;
    res.b <== counterSignedSigVerifier.valid;

    valid <== res.out;
}

template JoinMsgHash() {
    signal input userPubkey[2];
    signal input hubPubkey[2];
    signal output out;

    component hasher = Hasher5();
    hasher.in[0] <== 11174262654018418496616668956048135415153724061932452053335097373686592240616;
    hasher.in[1] <== userPubkey[0];
    hasher.in[2] <== userPubkey[1];
    hasher.in[3] <== hubPubkey[0];
    hasher.in[4] <== hubPubkey[1];

    out <== hasher.hash;
}

template RegisterNewHubHash() {
    signal input adminAddress;
    signal output out;

    component hasher = Hasher5();
    hasher.in[0] <== 1122637059787783884121270614611449342946993875255423905974201070879309325140;
    hasher.in[1] <== adminAddress;
    hasher.in[2] <== 0;
    hasher.in[3] <== 0;
    hasher.in[4] <== 0;

    out <== hasher.hash;
}

template JoinMsgSigVerifier() {
    signal input userPubkey[2];
    signal input userSigR8[2];
    signal input userSigS;
    signal input hubPubkey[2];
    signal input hubSigR8[2];
    signal input hubSigS;

    signal output valid;

    component hashedData = JoinMsgHash();
    hashedData.userPubkey[0] <== userPubkey[0];
    hashedData.userPubkey[1] <== userPubkey[1];
    hashedData.hubPubkey[0] <== hubPubkey[0];
    hashedData.hubPubkey[1] <== hubPubkey[1];

    component verifier = CounterSignedSigsVerifier();
    verifier.hashedData <== hashedData.out;
    verifier.pubkey[0] <== userPubkey[0];
    verifier.pubkey[1] <== userPubkey[1];
    verifier.sigR8[0] <== userSigR8[0];
    verifier.sigR8[1] <== userSigR8[1];
    verifier.sigS <== userSigS;
    verifier.counterSignedPubkey[0] <== hubPubkey[0];
    verifier.counterSignedPubkey[1] <== hubPubkey[1];
    verifier.counterSignedSigR8[0] <== hubSigR8[0];
    verifier.counterSignedSigR8[1] <== hubSigR8[1];
    verifier.counterSignedSigS <== hubSigS;

    valid <== verifier.valid;
}

template HubRegistryVerifier(levels) {
    signal input pubkeyHub[2];
    signal input sigHubR8[2];
    signal input sigHubS;
    // Assume every one knows admin's address.
    signal input adminAddress;

    // Merkle proof of the hub's registry
    signal input merklePathElements[levels][1];
    signal input merklePathIndices[levels];
    signal input merkleRoot;

    signal output valid;

    // Get signing hash
    component hashedData = RegisterNewHubHash();
    hashedData.adminAddress <== adminAddress;
    // Verify hub's signature
    component sigVerifier = EdDSAPoseidonVerifier_patched();
    sigVerifier.Ax <== pubkeyHub[0];
    sigVerifier.Ay <== pubkeyHub[1];
    sigVerifier.R8x <== sigHubR8[0];
    sigVerifier.R8y <== sigHubR8[1];
    sigVerifier.S <== sigHubS;
    sigVerifier.M <== hashedData.out;

    // Verify that the hub entry matches its merkle proof
    component hasher = Hasher11();
    hasher.in[0] <== sigHubR8[0];
    hasher.in[1] <== sigHubR8[1];
    hasher.in[2] <== sigHubS;
    hasher.in[3] <== pubkeyHub[0];
    hasher.in[4] <== pubkeyHub[1];
    hasher.in[5] <== adminAddress;
    hasher.in[6] <== 0;
    hasher.in[7] <== 0;
    hasher.in[8] <== 0;
    hasher.in[9] <== 0;
    hasher.in[10] <== 0;

    component leafVerifier = LeafExists(levels);
    leafVerifier.leaf <== hasher.hash;
    leafVerifier.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        leafVerifier.path_index[i] <== merklePathIndices[i];
        leafVerifier.path_elements[i][0] <== merklePathElements[i][0];
    }

    valid <== sigVerifier.valid;
}

// Created by H after H runs SMP with A where H is the initiator.
template ProofOfSMP(levels) {
    // TODO: Add check for points

    /* Private */
    signal private input sigCR8[2];
    signal private input sigCS;
    signal private input pubkeyHub[2];
    signal private input sigJoinMsgHubR8[2];
    signal private input sigJoinMsgHubS;

    // Merkle proof for hub's registry.
    signal private input merklePathElements[levels][1];
    signal private input merklePathIndices[levels];
    signal private input sigHubRegistryR8[2];
    signal private input sigHubRegistryS;

    signal private input h2;
    signal private input h3;
    signal private input r4h;

    /* Public */

    signal input pubkeyC[2];
    signal input adminAddress;
    signal input merkleRoot;
    // 5 = 4 + 1

    // msg 1
    signal input g2h[2];
    signal input g2hProofC;
    signal input g2hProofD;
    signal input g3h[2];
    signal input g3hProofC;
    signal input g3hProofD;
    // 13 = 5 + 8

    // msg 2
    signal input g2a[2];
    signal input g2aProofC;
    signal input g2aProofD;
    signal input g3a[2];
    signal input g3aProofC;
    signal input g3aProofD;
    signal input pa[2];  // 21, 22
    signal input qa[2];
    signal input paqaProofC;
    signal input paqaProofD0;
    signal input paqaProofD1;
    // 28 = 13 + 15

    // msg 3
    signal input ph[2];  // 28, 29
    signal input qh[2];
    signal input phqhProofC;
    signal input phqhProofD0;
    signal input phqhProofD1;
    signal input rh[2];  // 35, 36
    signal input rhProofC;
    signal input rhProofD;
    // 39 = 28 + 11

    signal output valid;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    /* join-hub signatures */
    component joinSigsVerifier = JoinMsgSigVerifier();
    joinSigsVerifier.userPubkey[0] <== pubkeyC[0];
    joinSigsVerifier.userPubkey[1] <== pubkeyC[1];
    joinSigsVerifier.userSigR8[0] <== sigCR8[0];
    joinSigsVerifier.userSigR8[1] <== sigCR8[1];
    joinSigsVerifier.userSigS <== sigCS;
    joinSigsVerifier.hubPubkey[0] <== pubkeyHub[0];
    joinSigsVerifier.hubPubkey[1] <== pubkeyHub[1];
    joinSigsVerifier.hubSigR8[0] <== sigJoinMsgHubR8[0];
    joinSigsVerifier.hubSigR8[1] <== sigJoinMsgHubR8[1];
    joinSigsVerifier.hubSigS <== sigJoinMsgHubS;
    joinSigsVerifier.valid === 1;

    /* merkle proof */
    // HubRegistryVerifier
    component hubRegistryVerifier = HubRegistryVerifier(levels);
    hubRegistryVerifier.merkleRoot <== merkleRoot;
    hubRegistryVerifier.pubkeyHub[0] <== pubkeyHub[0];
    hubRegistryVerifier.pubkeyHub[1] <== pubkeyHub[1];
    hubRegistryVerifier.sigHubR8[0] <== sigHubRegistryR8[0];
    hubRegistryVerifier.sigHubR8[1] <== sigHubRegistryR8[1];
    hubRegistryVerifier.sigHubS <== sigHubRegistryS;
    hubRegistryVerifier.adminAddress <== adminAddress;
    for (var i = 0; i < levels; i++) {
        hubRegistryVerifier.merklePathIndices[i] <== merklePathIndices[i];
        hubRegistryVerifier.merklePathElements[i][0] <== merklePathElements[i][0];
    }
    hubRegistryVerifier.valid === 1;

    /* msg 1 */

    // Ensure `g ** a2 == g2a` and `g ** a3 == g3a`
    component g2hCalc = BabyMulScalar(254);
    g2hCalc.scalar <== h2;
    g2hCalc.point[0] <== BASE8[0];
    g2hCalc.point[1] <== BASE8[1];
    component g2hCorrect = IsPointEqual();
    g2hCorrect.pointA[0] <== g2h[0];
    g2hCorrect.pointA[1] <== g2h[1];
    g2hCorrect.pointB[0] <== g2hCalc.out[0];
    g2hCorrect.pointB[1] <== g2hCalc.out[1];
    g2hCorrect.out === 1;

    component g3hCalc = BabyMulScalar(254);
    g3hCalc.scalar <== h3;
    g3hCalc.point[0] <== BASE8[0];
    g3hCalc.point[1] <== BASE8[1];
    component g3hCorrect = IsPointEqual();
    g3hCorrect.pointA[0] <== g3h[0];
    g3hCorrect.pointA[1] <== g3h[1];
    g3hCorrect.pointB[0] <== g3hCalc.out[0];
    g3hCorrect.pointB[1] <== g3hCalc.out[1];
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
    component g2 = BabyMulScalar(254);
    g2.scalar <== h2;
    g2.point[0] <== g2a[0];
    g2.point[1] <== g2a[1];
    component g3 = BabyMulScalar(254);
    g3.scalar <== h3;
    g3.point[0] <== g3a[0];
    g3.point[1] <== g3a[1];

    // Verify `Pa` and `Qa`, with the given inputs and the calculated `g2` and `g3`.
    component paqaProofVerifier = ProofEqualDiscreteCoordinatesVerifier();
    paqaProofVerifier.version <== 5;
    paqaProofVerifier.c <== paqaProofC;
    paqaProofVerifier.d0 <== paqaProofD0;
    paqaProofVerifier.d1 <== paqaProofD1;
    paqaProofVerifier.g0[0] <== g3.out[0];
    paqaProofVerifier.g0[1] <== g3.out[1];
    paqaProofVerifier.g1[0] <== BASE8[0];
    paqaProofVerifier.g1[1] <== BASE8[1];
    paqaProofVerifier.g2[0] <== g2.out[0];
    paqaProofVerifier.g2[1] <== g2.out[1];
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

    // Make sure `Qh` is calculated from `pubkeyC`
    component g1R4 = BabyMulScalar(254);
    g1R4.scalar <== r4h;
    g1R4.point[0] <== BASE8[0];
    g1R4.point[1] <== BASE8[1];
    component x = Hasher5();
    x.in[0] <== pubkeyC[0];
    x.in[1] <== pubkeyC[1];
    x.in[2] <== 0;
    x.in[3] <== 0;
    x.in[4] <== 0;
    component g2X = BabyMulScalar(254);
    g2X.scalar <== x.hash;
    g2X.point[0] <== g2.out[0];
    g2X.point[1] <== g2.out[1];
    component qhComputed = BabyAdd();
    qhComputed.x1 <== g1R4.out[0];
    qhComputed.y1 <== g1R4.out[1];
    qhComputed.x2 <== g2X.out[0];
    qhComputed.y2 <== g2X.out[1];
    component qhCorrect = IsPointEqual();
    qhCorrect.pointA[0] <== qh[0];
    qhCorrect.pointA[1] <== qh[1];
    qhCorrect.pointB[0] <== qhComputed.xout;
    qhCorrect.pointB[1] <== qhComputed.yout;
    qhCorrect.out === 1;

    // Verify `Ph` and `Qh`, with the given inputs and the calculated `g2` and `g3`.
    component phqhProofVerifier = ProofEqualDiscreteCoordinatesVerifier();
    phqhProofVerifier.version <== 6;
    phqhProofVerifier.c <== phqhProofC;
    phqhProofVerifier.d0 <== phqhProofD0;
    phqhProofVerifier.d1 <== phqhProofD1;
    phqhProofVerifier.g0[0] <== g3.out[0];
    phqhProofVerifier.g0[1] <== g3.out[1];
    phqhProofVerifier.g1[0] <== BASE8[0];
    phqhProofVerifier.g1[1] <== BASE8[1];
    phqhProofVerifier.g2[0] <== g2.out[0];
    phqhProofVerifier.g2[1] <== g2.out[1];
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
    qhOverQa.x2 <== qaInverse.out[0];
    qhOverQa.y2 <== qaInverse.out[1];

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
