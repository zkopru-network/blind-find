import {
  stringifyBigInts,
  sign,
  hash5,
  verifySignature,
  genPubKey
} from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";

import { smpHash } from "../../src/smp/v4/hash";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { G, q } from "../../src/smp/v4/state";
import { bigIntMod } from "../../src/smp/utils";
import { secretFactory } from "../../src/smp/v4/factories";
import { babyJubPointFactoryExclude } from "../utils";

jest.setTimeout(90000);

describe("smpHash", () => {
  const version = 1;

  test("result from circuit is correct", async () => {
    const args = [secretFactory(), secretFactory()];
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
    const privkey = secretFactory();
    const pubkey = genPubKey(privkey);
    const data = hash5([
      secretFactory(),
      secretFactory(),
      secretFactory(),
      secretFactory(),
      secretFactory()
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
      "main.out[0]"
    ).toString();
    const resCircuitY = getSignalByName(
      circuit,
      witness,
      "main.out[1]"
    ).toString();
    expect(resCircuitX).toEqual(res.point[0].toString());
    expect(resCircuitY).toEqual(res.point[1].toString());
  });

  test("point inverse should work in circuit", async () => {
    const privkey = secretFactory();
    const pubkey = genPubKey(privkey);
    const point = new BabyJubPoint(pubkey);
    const out = point.inverse();

    const circuit = await compileCircuit("testBabyJubInverse.circom");

    const circuitInputs = stringifyBigInts({
      point: [pubkey[0].toString(), pubkey[1].toString()]
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const resCircuitX = getSignalByName(
      circuit,
      witness,
      "main.out[0]"
    ).toString();
    const resCircuitY = getSignalByName(
      circuit,
      witness,
      "main.out[1]"
    ).toString();
    expect(resCircuitX).toEqual(out.point[0].toString());
    expect(resCircuitY).toEqual(out.point[1].toString());
  });
});

describe("point equal", () => {
  test("result from circuit is the same as the output calculated outside", async () => {
    const privkey = secretFactory();
    const point = new BabyJubPoint(G).exponentiate(privkey);
    const pointAnother = babyJubPointFactoryExclude([point]);
    expect(point.equal(point)).toBeTruthy();
    expect(point.equal(pointAnother)).toBeFalsy();
    const circuit = await compileCircuit("testPointEqual.circom");

    const verifyAEqualToB = async (a: BabyJubPoint, b: BabyJubPoint) => {
      const circuitInputs = stringifyBigInts({
        pointA: [a.point[0].toString(), a.point[1].toString()],
        pointB: [b.point[0].toString(), b.point[1].toString()]
      });
      const witness = await executeCircuit(circuit, circuitInputs);
      const res = getSignalByName(circuit, witness, "main.out").toString();
      return res === "1";
    };

    expect(await verifyAEqualToB(point, point)).toBeTruthy();
    expect(await verifyAEqualToB(point, pointAnother)).toBeFalsy();
  });
});

describe("Scalar verification", () => {
  test("point inverse should work in circuit", async () => {
    const privkey = bigIntMod(secretFactory(), q);

    const circuit = await compileCircuit("testScalarVerifier.circom");

    // valid
    const circuitInputs = stringifyBigInts({
      in: privkey.toString()
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const res = getSignalByName(circuit, witness, "main.valid").toString();
    expect(res).toEqual("0");

    // invalid
    const circuitInvalidInputs = stringifyBigInts({
      in: q.toString()
    });
    const invalidWitness = await executeCircuit(circuit, circuitInvalidInputs);
    const resFailed = getSignalByName(
      circuit,
      invalidWitness,
      "main.valid"
    ).toString();
    expect(resFailed).toEqual("1");
  });
});
