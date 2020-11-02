include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/escalarmulany.circom";

// Copied and modified from maci-circuits/ecdh.circom

// TODO: Check if the point is in the subgroup.
template EcScalarMul(nBits) {
  signal input scalar;
  signal input point[2];

  signal output res[2];

  component scalarBits = Num2Bits(nBits);
  scalarBits.in <== scalar;

  component mulFix = EscalarMulAny(nBits);
  mulFix.p[0] <== point[0];
  mulFix.p[1] <== point[1];

  for (var i = 0; i < nBits; i++) {
    mulFix.e[i] <== scalarBits.out[i];
  }

  res[0] <== mulFix.out[0];
  res[1] <== mulFix.out[1];
}