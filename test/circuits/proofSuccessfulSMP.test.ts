import { stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { babyJubPointFactoryExclude, bigIntFactoryExclude } from "../utils";
import { SMPStateMachine } from "../../src/smp/v4/state";
import {
  SMPMessage2Wire,
  SMPMessage3Wire
} from "../../src/smp/v4/serialization";
import { SMPState1 } from "../../src/smp/state";
import { BabyJubPoint } from "../../src/smp/v4/babyJub";

jest.setTimeout(90000);

describe("Circuit of the Proof of Successful SMP", () => {
  const secret = "hello world";
  const alice = new SMPStateMachine(secret);
  const hub = new SMPStateMachine(secret);
  const a3 = (alice.state as SMPState1).s3;
  const msg1TLV = hub.transit(null);
  const msg2TLV = alice.transit(msg1TLV);
  const msg3TLV = hub.transit(msg2TLV);
  alice.transit(msg3TLV);
  expect(alice.isFinished()).toBeTruthy();
  expect(alice.getResult()).toBeTruthy();
  expect(hub.isFinished()).toBeFalsy();

  if (msg1TLV === null || msg2TLV === null || msg3TLV === null) {
    throw new Error();
  }
  const msg2 = SMPMessage2Wire.fromTLV(msg2TLV);
  const msg3 = SMPMessage3Wire.fromTLV(msg3TLV);
  const pa = msg2.pb;
  const ph = msg3.pa;
  const rh = msg3.ra;

  test("", async () => {
    const circuit = await compileCircuit("testProofSuccessfulSMP.circom");

    const verifyProofSuccessfulSMP = async (
      a3: BigInt,
      pa: BabyJubPoint,
      ph: BabyJubPoint,
      rh: BabyJubPoint
    ) => {
      const args = stringifyBigInts({
        a3: a3.toString(),
        pa: [pa.point[0].toString(), pa.point[1].toString()],
        ph: [ph.point[0].toString(), ph.point[1].toString()],
        rh: [rh.point[0].toString(), rh.point[1].toString()]
      });
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      return res === "1";
    };

    // Succeeds
    expect(await verifyProofSuccessfulSMP(a3, pa, ph, rh)).toBeTruthy();

    // Fails when wrong arguments are given.
    const sAnother = bigIntFactoryExclude([a3]);
    const gAnother = babyJubPointFactoryExclude([pa, ph, rh]);
    await expect(
      verifyProofSuccessfulSMP(sAnother, gAnother, ph, rh)
    ).rejects.toThrow();
    await expect(
      verifyProofSuccessfulSMP(a3, pa, gAnother, rh)
    ).rejects.toThrow();
    await expect(
      verifyProofSuccessfulSMP(a3, pa, ph, gAnother)
    ).rejects.toThrow();
  });
});
