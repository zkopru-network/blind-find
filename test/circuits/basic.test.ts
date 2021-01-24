import { stringifyBigInts, genPubKey, genKeypair } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";

import { smpHash } from "../../src/smp/v4/hash";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { G } from "../../src/smp/v4/state";
import { secretFactory } from "../../src/smp/v4/factories";
import { babyJubPointFactoryExclude } from "../utils";
import {
  adminAddressFactory,
  hubRegistryTreeFactory
} from "../../src/factories";

import chai from 'chai';
const expect = chai.expect;

describe("smpHash", function () {
  this.timeout(90000);

  const version = 1;

  it("result from circuit is correct", async () => {
    const args = [secretFactory(), secretFactory()];
    const resJs = smpHash(version, ...args);

    const actualPreImages = [BigInt(version), ...args, BigInt(0), BigInt(0)]; // Padded with 0 to 5.
    const circuit = await compileCircuit("testHasher5.circom");
    const circuitInputs = stringifyBigInts({
      in: actualPreImages
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const output = getSignalByName(circuit, witness, "main.hash");
    expect(output.toString()).to.eql(resJs.toString());
  });
});

describe("point computation", () => {
  it("result from circuit is the same as the output calculated outside", async () => {
    const privkey = secretFactory();
    const point = new BabyJubPoint(G).exponentiate(privkey);
    const scalar = secretFactory();
    const res = point.exponentiate(scalar);
    expect(res.isValid()).to.be.true;

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
    expect(resCircuitX).to.eql(res.point[0].toString());
    expect(resCircuitY).to.eql(res.point[1].toString());
  });

  it("point inverse should work in circuit", async () => {
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
    expect(resCircuitX).to.eql(out.point[0].toString());
    expect(resCircuitY).to.eql(out.point[1].toString());
  });
});

describe("point equal", () => {
  it("result from circuit is the same as the output calculated outside", async () => {
    const privkey = secretFactory();
    const point = new BabyJubPoint(G).exponentiate(privkey);
    const pointAnother = babyJubPointFactoryExclude([point]);
    expect(point.equal(point)).to.be.true;
    expect(point.equal(pointAnother)).to.be.false;
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

    expect(await verifyAEqualToB(point, point)).to.be.true;
    expect(await verifyAEqualToB(point, pointAnother)).to.be.false;
  });
});

describe("merkle proof", () => {
  const levels = 4;

  it("merkle proof should be verified successfully in the circuit", async () => {
    const adminAddress = adminAddressFactory();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const tree = hubRegistryTreeFactory(hubs, levels, adminAddress);

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
    expect(await verifyMerkleProof(0)).to.be.true;
  });
});
