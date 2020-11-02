include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

template ScalarVerifier() {
    signal input in;
    signal output valid;

    component bits = Num2Bits(253);
    bits.in <== in;
    // Ensure scalar is smaller than `subOrder`.
    // subOrder - 1
    component compConstant = CompConstant(2736030358979909402780800718157159386076813972158567259200215660948447373040);
    var i;
    for (i=0; i<253; i++) {
        bits.out[i] ==> compConstant.in[i];
    }
    compConstant.in[253] <== 0;
    valid <== compConstant.out;
}
