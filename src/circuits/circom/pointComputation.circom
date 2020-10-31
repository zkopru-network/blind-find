template BabyInverse() {
    signal input point[2];
    signal output pointInverse[2];

    pointInverse[0] <== (-1 * point[0]);
    pointInverse[1] <== point[1];
}
