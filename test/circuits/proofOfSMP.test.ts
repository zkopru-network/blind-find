import { performance } from "perf_hooks";
import { genKeypair, stringifyBigInts } from "maci-crypto";
import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { bigIntFactoryExclude } from "../utils";
import { SMPStateMachine } from "../../src/smp/v4/state";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "../../src/smp/v4/serialization";
import { SMPState1 } from "../../src/smp/state";
import {
  getCounterSignHashedData,
  getJoinHubMsgHashedData,
  signMsg
} from "../../src";
import { hubRegistryTreeFactory } from "../../src/factories";

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
  alice.transit(msg3TLV);
  expect(alice.isFinished()).toBeTruthy();
  expect(alice.getResult()).toBeTruthy();
  expect(hub.isFinished()).toBeFalsy();

  if (msg1TLV === null || msg2TLV === null || msg3TLV === null) {
    throw new Error();
  }
  const msg1 = SMPMessage1Wire.fromTLV(msg1TLV);
  const msg2 = SMPMessage2Wire.fromTLV(msg2TLV);
  const msg3 = SMPMessage3Wire.fromTLV(msg3TLV);

  test("", async () => {
    const hubIndex = 3;
    const levels = 4;
    const hubs = [
      genKeypair(),
      genKeypair(),
      genKeypair(),
      genKeypair(),
      genKeypair()
    ];
    const admin = genKeypair();
    const keypairC = genKeypair();
    const keypairHub = hubs[hubIndex];
    const joinHubMsg = getJoinHubMsgHashedData(
      keypairC.pubKey,
      keypairHub.pubKey
    );
    const sigJoinMsgC = signMsg(keypairC.privKey, joinHubMsg);
    const sigJoinMsgHub = signMsg(
      keypairHub.privKey,
      getCounterSignHashedData(sigJoinMsgC)
    );
    const tree = hubRegistryTreeFactory(hubs, levels, admin);
    const hubRegistry = tree.leaves[hubIndex];
    const root = tree.tree.root;
    const proof = tree.tree.genMerklePath(hubIndex);

    const t0 = performance.now();
    const circuit = await compileCircuit("testProofOfSMP.circom");
    const t1 = performance.now();
    const tCompile = t1 - t0;
    const verifyProofOfSMP = async (
      msg1: SMPMessage1Wire,
      msg2: SMPMessage2Wire,
      msg3: SMPMessage3Wire
    ) => {
      /**
       * signal input pubkeyAdmin[2];
       * signal input merkleRoot;
       * signal private input merklePathElements[levels][1];
       * signal private input merklePathIndices[levels];
       * signal private input sigAdminR8[2];
       * signal private input sigAdminS;
       */
      if (!hubRegistry.verify()) {
        throw new Error(`registry is invalid: hubIndex=${hubIndex}`);
      }
      if (
        hubRegistry.adminPubkey === undefined ||
        hubRegistry.adminSig === undefined
      ) {
        throw new Error(
          `registry is not counter-signed: hubRegistry=${hubRegistry}`
        );
      }
      const args = stringifyBigInts({
        merklePathElements: proof.pathElements,
        merklePathIndices: proof.indices,
        merkleRoot: root,
        sigHubRegistryR8: [
          hubRegistry.sig.R8[0].toString(),
          hubRegistry.sig.R8[1].toString()
        ],
        sigHubRegistryS: hubRegistry.sig.S.toString(),
        sigAdminR8: [
          hubRegistry.adminSig.R8[0].toString(),
          hubRegistry.adminSig.R8[1].toString()
        ],
        sigAdminS: hubRegistry.adminSig.S.toString(),
        pubkeyAdmin: [
          hubRegistry.adminPubkey[0].toString(),
          hubRegistry.adminPubkey[1].toString()
        ],
        pubkeyC: [keypairC.pubKey[0].toString(), keypairC.pubKey[1].toString()],
        sigCR8: [sigJoinMsgC.R8[0].toString(), sigJoinMsgC.R8[1].toString()],
        sigCS: sigJoinMsgC.S.toString(),
        pubkeyHub: [
          keypairHub.pubKey[0].toString(),
          keypairHub.pubKey[1].toString()
        ],
        sigJoinMsgHubR8: [
          sigJoinMsgHub.R8[0].toString(),
          sigJoinMsgHub.R8[1].toString()
        ],
        sigJoinMsgHubS: sigJoinMsgHub.S.toString(),
        h2: h2.toString(),
        h3: h3.toString(),
        g2h: [msg1.g2a.point[0].toString(), msg1.g2a.point[1].toString()],
        g2hProofC: msg1.g2aProof.c.toString(),
        g2hProofD: msg1.g2aProof.d.toString(),
        g3h: [msg1.g3a.point[0].toString(), msg1.g3a.point[1].toString()],
        g3hProofC: msg1.g3aProof.c.toString(),
        g3hProofD: msg1.g3aProof.d.toString(),
        g2a: [msg2.g2b.point[0].toString(), msg2.g2b.point[1].toString()],
        g2aProofC: msg2.g2bProof.c.toString(),
        g2aProofD: msg2.g2bProof.d.toString(),
        g3a: [msg2.g3b.point[0].toString(), msg2.g3b.point[1].toString()],
        g3aProofC: msg2.g3bProof.c.toString(),
        g3aProofD: msg2.g3bProof.d.toString(),
        pa: [msg2.pb.point[0].toString(), msg2.pb.point[1].toString()],
        qa: [msg2.qb.point[0].toString(), msg2.qb.point[1].toString()],
        paqaProofC: msg2.pbqbProof.c.toString(),
        paqaProofD0: msg2.pbqbProof.d0.toString(),
        paqaProofD1: msg2.pbqbProof.d1.toString(),
        ph: [msg3.pa.point[0].toString(), msg3.pa.point[1].toString()],
        qh: [msg3.qa.point[0].toString(), msg3.qa.point[1].toString()],
        phqhProofC: msg3.paqaProof.c.toString(),
        phqhProofD0: msg3.paqaProof.d0.toString(),
        phqhProofD1: msg3.paqaProof.d1.toString(),
        rh: [msg3.ra.point[0].toString(), msg3.ra.point[1].toString()],
        rhProofC: msg3.raProof.c.toString(),
        rhProofD: msg3.raProof.d.toString()
      });
      const witness = await executeCircuit(circuit, args);
      const res = getSignalByName(circuit, witness, "main.valid").toString();

      return res === "1";
    };

    // Succeeds
    expect(await verifyProofOfSMP(msg1, msg2, msg3)).toBeTruthy();

    const t2 = performance.now();
    const tRunSucceeds = t2 - t1;
    // Fails if msg1 is malformed.
    const msg1Invalid = SMPMessage1Wire.fromTLV(msg1TLV);
    msg1Invalid.g2aProof.c = bigIntFactoryExclude([msg1Invalid.g2aProof.c]);
    await expect(verifyProofOfSMP(msg1Invalid, msg2, msg3)).rejects.toThrow();

    const t3 = performance.now();
    const tRunInvalidMsg1 = t3 - t2;
    // Fails if msg2 is malformed.
    const msg2Invalid = SMPMessage2Wire.fromTLV(msg2TLV);
    msg2Invalid.g2bProof.d = bigIntFactoryExclude([msg2Invalid.g2bProof.d]);
    await expect(verifyProofOfSMP(msg1, msg2Invalid, msg3)).rejects.toThrow();
    const t4 = performance.now();
    const tRunInvalidMsg2 = t4 - t3;

    // Fails if msg3 is malformed.
    const msg3Invalid = SMPMessage3Wire.fromTLV(msg3TLV);
    msg3Invalid.paqaProof.d1 = bigIntFactoryExclude([msg3Invalid.paqaProof.d1]);
    await expect(verifyProofOfSMP(msg1, msg2, msg3Invalid)).rejects.toThrow();
    const t5 = performance.now();
    const tRunInvalidMsg3 = t5 - t4;

    console.log(
      `tCompile = ${tCompile}, `,
      `tRunSucceeds = ${tRunSucceeds}, `,
      `tRunInvalidMsg1 = ${tRunInvalidMsg1}, `,
      `tRunInvalidMsg2 = ${tRunInvalidMsg2}, `,
      `tRunInvalidMsg3 = ${tRunInvalidMsg3}`
    );
  });
});
