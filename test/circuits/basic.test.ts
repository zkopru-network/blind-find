import { stringifyBigInts, genPubKey, genKeypair } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";

import { smpHash } from "../../src/smp/v4/hash";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { G } from "../../src/smp/v4/state";
import { secretFactory } from "../../src/smp/v4/factories";
import { babyJubPointFactoryExclude } from "../utils";
import { hubRegistryTreeFactory } from "../../src/factories";

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

describe("point computation", () => {
  test("result from circuit is the same as the output calculated outside", async () => {
    const privkey = secretFactory();
    const point = new BabyJubPoint(G).exponentiate(privkey);
    // const point = new BabyJubPoint(pubkey);
    const scalar = secretFactory();
    const res = point.exponentiate(scalar);
    expect(res.isValid()).toBeTruthy();

    const circuit = await compileCircuit("testBabyMulScalar.circom");

    const circuitInputs = stringifyBigInts({
      scalar: scalar,
      point: point.point
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

    const circuitInputs = stringifyBigInts({ point: pubkey });
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
        pointA: a.point,
        pointB: b.point
      });
      const witness = await executeCircuit(circuit, circuitInputs);
      const res = getSignalByName(circuit, witness, "main.out").toString();
      return res === "1";
    };

    expect(await verifyAEqualToB(point, point)).toBeTruthy();
    expect(await verifyAEqualToB(point, pointAnother)).toBeFalsy();
  });
});

describe("merkle proof", () => {
  const levels = 4;

  test("merkle proof should be verified successfully in the circuit", async () => {
    const admin = genKeypair();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const tree = hubRegistryTreeFactory(hubs, levels, admin);

    const circuit = await compileCircuit("testMerkleProof.circom");

    const verifyMerkleProof = async (i: number) => {
      const root = tree.tree.root;
      const proof = tree.tree.genMerklePath(i);
      const circuitInputs = {
        leaf: tree.leaves[i].hash(),
        path_elements: proof.pathElements,
        path_index: proof.indices,
        root
      };
      const witness = await executeCircuit(circuit, circuitInputs);
      const circuitRoot = getSignalByName(
        circuit,
        witness,
        "main.root"
      ).toString();
      return circuitRoot === root.toString();
    };
    expect(await verifyMerkleProof(0)).toBeTruthy();
  });
});
