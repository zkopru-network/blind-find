import { stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog
} from "../../src/smp/proofs";

import { q } from "../../src/smp/v4/state";
import { secretFactory, babyJubPointFactory } from "../../src/smp/v4/factories";

import { compileCircuit } from "./utils";
import { IGroup } from "../../src/smp/interfaces";
import { smpHash } from "../../src/smp/v4/hash";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { ValueError } from "../../src/smp/exceptions";

jest.setTimeout(90000);

const version = 1;

const hash = (...args: IGroup[]): BigInt => {
  const argsBigInts: BigInt[] = [];
  if (args.length >= 2) {
    throw new ValueError("too many arguments");
  }
  for (const arg of args) {
    const argPoint = arg as BabyJubPoint;
    argsBigInts.push(argPoint.point[0]);
    argsBigInts.push(argPoint.point[1]);
  }
  return smpHash(version, ...argsBigInts);
};

describe("proof of discrete log", () => {
  test("should be verified in circuit", async () => {
    const g = babyJubPointFactory();
    const x = secretFactory();
    const y = g.exponentiate(x);
    const r = secretFactory();
    const pf = makeProofDiscreteLog(hash, g, x, r, q);
    expect(verifyProofDiscreteLog(hash, pf, g, y)).toBeTruthy();
    const circuit = await compileCircuit(
      "testProofOfDiscreteLogVerifier.circom"
    );
    const circuitInputs = stringifyBigInts({
      version: BigInt(1).toString(),
      c: pf.c.toString(),
      d: pf.d.toString(),
      g: [g.point[0].toString(), g.point[1].toString()],
      y: [y.point[0].toString(), y.point[1].toString()]
    });
    const witness = await executeCircuit(circuit, circuitInputs);
    const validity = getSignalByName(circuit, witness, "main.valid").toString();
    expect(validity).toEqual("1");
  });
});
