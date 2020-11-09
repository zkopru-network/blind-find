template BabyInverse() {
    signal input point[2];
    signal output out[2];

    out[0] <== (-1 * point[0]);
    out[1] <== point[1];
}
