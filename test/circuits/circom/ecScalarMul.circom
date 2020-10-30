include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/escalarmulany.circom";

// Copied and modified from maci-circuits/ecdh.circom

// TODO: Check if public key is on the point
template EcScalarMul() {
  // Note: private key
  // Needs to be hashed, and then pruned before
  // supplying it to the circuit
  signal private input scalar;
  signal input point[2];

  signal output res[2];

  component scalarBits = Num2Bits(253);
  scalarBits.in <== scalar;

  component mulFix = EscalarMulAny(253);
  mulFix.p[0] <== point[0];
  mulFix.p[1] <== point[1];

  for (var i = 0; i < 253; i++) {
    mulFix.e[i] <== scalarBits.out[i];
  }

  res[0] <== mulFix.out[0];
  res[1] <== mulFix.out[1];
}

component main = EcScalarMul();
