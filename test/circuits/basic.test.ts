import { stringifyBigInts, genRandomSalt, sign, hash5 } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";

import { smpHash } from "../../src/smp/v4/hash";
import { verifySignature } from "maci-crypto";
import { genPubKey } from "maci-crypto";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { G, q } from "../../src/smp/v4/state";
import { bigIntMod } from "../../src/smp/utils";
import { secretFactory } from "../../src/smp/v4/factories";
jest.setTimeout(90000);

describe("smpHash", () => {
  const version = 1;

  test("result from circuit is correct", async () => {
    const args = [genRandomSalt(), genRandomSalt()];
    const resJs = smpHash(version, ...args);

    const actualPreImages = [BigInt(version), ...args, BigInt(0), BigInt(0)]; // Padded with 0 to 5.
    const circuit = await compileCircuit("testHasher5.circom");
    const circuitInputs = stringifyBigInts({
      in: actualPreImages
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const output = getSignalByName(circuit, witness, "main.hash");
    expect(output.toString()).toEqual(resJs.toString());
  });
});

describe("babyJub signature", () => {
  test("result from circuit is the same as the output calculated outside", async () => {
    const privkey = genRandomSalt();
    const pubkey = genPubKey(privkey);
    const data = hash5([
      genRandomSalt(),
      genRandomSalt(),
      genRandomSalt(),
      genRandomSalt(),
      genRandomSalt()
    ]);
    const sig = sign(privkey, data);
    expect(verifySignature(data, sig, pubkey)).toBeTruthy();

    const circuit = await compileCircuit("verifySignature.circom");
    const circuitInputs = stringifyBigInts({
      Ax: stringifyBigInts(pubkey[0]),
      Ay: stringifyBigInts(pubkey[1]),
      R8x: stringifyBigInts(sig.R8[0]),
      R8y: stringifyBigInts(sig.R8[1]),
      S: stringifyBigInts(sig.S),
      M: stringifyBigInts(data)
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const isValid = getSignalByName(circuit, witness, "main.valid").toString();
    expect(isValid).toEqual("1");
  });
});

describe("point computation", () => {
  test("result from circuit is the same as the output calculated outside", async () => {
    const privkey = secretFactory();
    const point = new BabyJubPoint(G).exponentiate(privkey);
    // const point = new BabyJubPoint(pubkey);
    const scalar = secretFactory();
    const res = point.exponentiate(scalar);
    expect(res.isValid()).toBeTruthy();

    const circuit = await compileCircuit("testEcScalarMul.circom");

    // FIXME: format scalar with `formatPrivKeyForBabyJub`
    const circuitInputs = stringifyBigInts({
      scalar: scalar.toString(),
      point: [point.point[0].toString(), point.point[1].toString()]
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const resCircuitX = getSignalByName(
      circuit,
      witness,
      "main.res[0]"
    ).toString();
    const resCircuitY = getSignalByName(
      circuit,
      witness,
      "main.res[1]"
    ).toString();
    expect(resCircuitX).toEqual(res.point[0].toString());
    expect(resCircuitY).toEqual(res.point[1].toString());
  });

  test("point inverse should work in circuit", async () => {
    const privkey = bigIntMod(genRandomSalt(), q);
    const pubkey = genPubKey(privkey);
    const point = new BabyJubPoint(pubkey);
    const pointInverse = point.inverse();

    const circuit = await compileCircuit("testBabyJubInverse.circom");

    const circuitInputs = stringifyBigInts({
      point: [pubkey[0].toString(), pubkey[1].toString()]
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const resCircuitX = getSignalByName(
      circuit,
      witness,
      "main.pointInverse[0]"
    ).toString();
    const resCircuitY = getSignalByName(
      circuit,
      witness,
      "main.pointInverse[1]"
    ).toString();
    expect(resCircuitX).toEqual(pointInverse.point[0].toString());
    expect(resCircuitY).toEqual(pointInverse.point[1].toString());
  });
});
