import { genKeypair, Keypair, stringifyBigInts } from "maci-crypto";
import {
  getCounterSignHashedData,
  getJoinHubMsgHashedData,
  HubRegistry,
  HubRegistryTree,
  prefixRegisterNewHub,
  signMsg
} from "./";
import { SMPStateMachine } from "./smp";
import { SMPState1 } from "./smp/state";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "./smp/v4/serialization";

export const hubRegistryFactory = (
  adminKeypair?: Keypair,
  hubKeypair?: Keypair
): HubRegistry => {
  if (hubKeypair === undefined) {
    hubKeypair = genKeypair();
  }
  if (adminKeypair === undefined) {
    adminKeypair = genKeypair();
  }
  const sig = signMsg(hubKeypair.privKey, prefixRegisterNewHub);
  const registry = new HubRegistry(sig, hubKeypair.pubKey);
  registry.adminSign(adminKeypair);
  return registry;
};

export const hubRegistryTreeFactory = (
  hubs?: Keypair[],
  levels = 5,
  adminKeypair?: Keypair
): HubRegistryTree => {
  if (adminKeypair === undefined) {
    adminKeypair = genKeypair();
  }
  const tree = new HubRegistryTree(levels);
  if (hubs === undefined) {
    return tree;
  }
  if (hubs.length > 2 ** levels) {
    throw new Error(
      "num leaves should not be greater than 2**levels: " +
        `hubs.length=${hubs.length}, levels=${levels}`
    );
  }
  for (let i = 0; i < hubs.length; i++) {
    const registry = hubRegistryFactory(adminKeypair, hubs[i]);
    tree.insert(registry);
  }
  return tree;
};

// Should be only initialized once.
let sueccessfulSMPMessages: {
  msg1: SMPMessage1Wire;
  msg2: SMPMessage2Wire;
  msg3: SMPMessage3Wire;
  h2: BigInt;
  h3: BigInt;
  a2: BigInt;
  a3: BigInt;
} | null = null;

export const successfulSMPMessagesFactory = () => {
  if (sueccessfulSMPMessages === null) {
    const secret = "hello world";
    const alice = new SMPStateMachine(secret);
    const hub = new SMPStateMachine(secret);
    const a2 = (alice.state as SMPState1).s2;
    const a3 = (alice.state as SMPState1).s3;
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
    sueccessfulSMPMessages = { msg1, msg2, msg3, h2, h3, a2, a3 };
  }
  return sueccessfulSMPMessages;
};

export const proofOfSMPArgsFactory = (levels: number = 32) => {
  const { msg1, msg2, msg3, h2, h3, a2, a3 } = successfulSMPMessagesFactory();
  const hubIndex = 3;
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
  return { args, msg1, msg2, msg3, h2, h3, a2, a3 };
};

export const proofSuccessfulSMPArgsFactory = () => {
  const { msg1, msg2, msg3, h2, h3, a2, a3 } = successfulSMPMessagesFactory();

  const pa = msg2.pb;
  const ph = msg3.pa;
  const rh = msg3.ra;
  const args = stringifyBigInts({
    a3: a3.toString(),
    pa: [pa.point[0].toString(), pa.point[1].toString()],
    ph: [ph.point[0].toString(), ph.point[1].toString()],
    rh: [rh.point[0].toString(), rh.point[1].toString()]
  });
  return { args, msg1, msg2, msg3, h2, h3, a2, a3 };
};
