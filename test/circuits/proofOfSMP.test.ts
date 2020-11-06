import { stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import {
  babyJubPointFactoryExclude,
  bigIntFactoryExclude,
  factoryExclude
} from "../utils";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";
import { G, SMPStateMachine } from "../../src/smp/v4/state";
import { SMPMessage1, SMPMessage2, SMPMessage3 } from "../../src/smp/msgs";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "../../src/smp/v4/serialization";
import { secretFactory } from "../../src/smp/v4/factories";
import { SMPState1 } from "../../src/smp/state";

jest.setTimeout(90000);

describe("proof of smp", () => {
  const secret = "hello world";
  const alice = new SMPStateMachine(secret);
  const hub = new SMPStateMachine(secret);
  const h2 = (hub.state as SMPState1).s2;
  const h3 = (hub.state as SMPState1).s3;
  const msg1TLV = hub.transit(null);
  const msg2TLV = alice.transit(msg1TLV);
  const msg3TLV = hub.transit(msg2TLV);
  const msg4TLV = alice.transit(msg3TLV);
  expect(alice.isFinished()).toBeTruthy();
  expect(hub.isFinished()).toBeFalsy();

  if (msg1TLV === null || msg2TLV === null || msg3TLV === null) {
    throw new Error();
  }
  const msg1 = SMPMessage1Wire.fromTLV(msg1TLV);
  const msg2 = SMPMessage2Wire.fromTLV(msg2TLV);
  const msg3 = SMPMessage3Wire.fromTLV(msg3TLV);

  test("", async () => {
    const circuit = await compileCircuit("testProofOFSMP.circom");

    const verifyProofOfSMP = async (
      msg1: SMPMessage1Wire,
      msg2: SMPMessage2Wire,
      msg3: SMPMessage3Wire
    ) => {
      const args = stringifyBigInts({
        h2: h2.toString(),
        h3: h3.toString(),
        g2h: [msg1.g2a.point[0].toString(), msg1.g2a.point[1].toString()],
        g2hProofC: msg1.g2aProof.c.toString(),
        g2hProofD: msg1.g2aProof.d.toString(),
        g3h: [msg1.g3a.point[0].toString(), msg1.g3a.point[1].toString()],
        g3hProofC: msg1.g3aProof.c.toString(),
        g3hProofD: msg1.g3aProof.d.toString()
      });
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      const tt = getSignalByName(circuit, witness, "main.tt").toString();
      const ts = getSignalByName(circuit, witness, "main.ts").toString();
      console.log(`tt = ${tt}`);
      console.log(`ts = ${ts}`);
      return res === "1";
    };
    // Succeeds
    expect(await verifyProofOfSMP(msg1, msg2, msg3)).toBeTruthy();

    // Fails if msg1 is malformed.
    const msg1Invalid = SMPMessage1Wire.fromTLV(msg1TLV);
    msg1Invalid.g2aProof.c = bigIntFactoryExclude([msg1Invalid.g2aProof.c]);
    await expect(verifyProofOfSMP(msg1Invalid, msg2, msg3)).rejects.toThrow();

    // // Fails if msg2 is malformed.
    // const msg2Invalid = SMPMessage2Wire.fromTLV(msg2TLV);
    // msg2Invalid.g2bProof.d = bigIntFactoryExclude([msg2Invalid.g2bProof.d]);
    // await expect(verifyProofOfSMP(msg1, msg2Invalid, msg3)).rejects.toThrow();

    // // Fails if msg3 is malformed.
    // const msg3Invalid = SMPMessage3Wire.fromTLV(msg3TLV);
    // msg3Invalid.paqaProof.d1 = bigIntFactoryExclude([msg3Invalid.paqaProof.d1]);
    // await expect(verifyProofOfSMP(msg1, msg2, msg3Invalid)).rejects.toThrow();
  });
});
