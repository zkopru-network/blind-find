import { genKeypair, Keypair, PubKey, Signature } from "maci-crypto";
import {
  getCounterSignHashedData,
  getJoinHubMsgHashedData,
  HubRegistry,
  HubRegistryTree,
  prefixRegisterNewHub,
  signMsg
} from "./";
import { SMPStateMachine } from "./smp";
import { SMPState1, SMPState2 } from "./smp/state";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "./smp/v4/serialization";
import { hashPointToScalar } from "./utils";

type SignedJoinMsg = {
  userPubkey: PubKey;
  userSig: Signature;
  hubPubkey: PubKey;
  hubSig: Signature;
};

export const signedJoinMsgFactory = (
  userKeypair?: Keypair,
  hubKeypair?: Keypair
): SignedJoinMsg => {
  if (userKeypair === undefined) {
    userKeypair = genKeypair();
  }
  if (hubKeypair === undefined) {
    hubKeypair = genKeypair();
  }
  const joinMsg = getJoinHubMsgHashedData(
    userKeypair.pubKey,
    hubKeypair.pubKey
  );
  const sig = signMsg(userKeypair.privKey, joinMsg);
  const counterSignedhashedData = getCounterSignHashedData(sig);
  const sigHub = signMsg(hubKeypair.privKey, counterSignedhashedData);
  return {
    userPubkey: userKeypair.pubKey,
    userSig: sig,
    hubPubkey: hubKeypair.pubKey,
    hubSig: sigHub
  };
};

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

// Should be only initialized once, to avoid redundant expensive SMP calculations.
let sueccessfulSMPMessages: {
  msg1: SMPMessage1Wire;
  msg2: SMPMessage2Wire;
  msg3: SMPMessage3Wire;
  h2: BigInt;
  h3: BigInt;
  a2: BigInt;
  a3: BigInt;
  r4h: BigInt;
} | null = null;

export const successfulSMPMessagesFactory = (secret: BigInt = BigInt(1)) => {
  if (sueccessfulSMPMessages === null) {
    const alice = new SMPStateMachine(secret);
    const hub = new SMPStateMachine(secret);
    const a2 = (alice.state as SMPState1).s2;
    const a3 = (alice.state as SMPState1).s3;
    const h2 = (hub.state as SMPState1).s2;
    const h3 = (hub.state as SMPState1).s3;
    const msg1TLV = hub.transit(null);
    const msg2TLV = alice.transit(msg1TLV);
    const hubState2 = hub.state as SMPState2;
    const msg3TLV = hub.transit(msg2TLV);
    if (hubState2.r4 === undefined) {
      throw new Error("r4 should have been generated to compute Ph and Qh");
    }
    const r4h = hubState2.r4;
    // Get `r4` after hub transits from state 2 to state 4.
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
    sueccessfulSMPMessages = { msg1, msg2, msg3, h2, h3, a2, a3, r4h };
  }
  return sueccessfulSMPMessages;
};

export const proofOfSMPInputsFactory = (levels: number = 32) => {
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
  const signedJoinMsg = signedJoinMsgFactory(keypairC, keypairHub);
  const sigJoinMsgC = signedJoinMsg.userSig;
  const sigJoinMsgHub = signedJoinMsg.hubSig;
  const tree = hubRegistryTreeFactory(hubs, levels, admin);
  const hubRegistry = tree.leaves[hubIndex];
  const root = tree.tree.root;
  const proof = tree.tree.genMerklePath(hubIndex);
  const secret = hashPointToScalar(keypairC.pubKey);
  const {
    msg1,
    msg2,
    msg3,
    h2,
    h3,
    a2,
    a3,
    r4h
  } = successfulSMPMessagesFactory(secret);

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
  return {
    root,
    proof: proof as any,
    hubRegistry,
    pubkeyC: keypairC.pubKey,
    pubkeyHub: keypairHub.pubKey,
    pubkeyAdmin: admin.pubKey,
    sigJoinMsgC,
    sigJoinMsgHub,
    msg1,
    msg2,
    msg3,
    h2,
    h3,
    a2,
    a3,
    r4h
  };
};

export const proofSuccessfulSMPInputsFactory = () => {
  const {
    msg1,
    msg2,
    msg3,
    h2,
    h3,
    a2,
    a3,
    r4h
  } = successfulSMPMessagesFactory();

  const pa = msg2.pb;
  const ph = msg3.pa;
  const rh = msg3.ra;
  const keypairA = genKeypair();
  const pubkeyA = keypairA.pubKey;
  const signingHash = hashPointToScalar(rh.point);
  const sigRh = signMsg(keypairA.privKey, signingHash);
  return { pa, ph, rh, msg1, msg2, msg3, h2, h3, r4h, a2, a3, pubkeyA, sigRh };
};

export const proofIndirectConnectionInputsFactory = (levels: number = 32) => {
  let inputs = proofOfSMPInputsFactory(levels);
  const pa = inputs.msg2.pb;
  const ph = inputs.msg3.pa;
  const rh = inputs.msg3.ra;
  const keypairA = genKeypair();
  const pubkeyA = keypairA.pubKey;
  const sigRh = signMsg(keypairA.privKey, hashPointToScalar(rh.point));
  return {
    pa: pa,
    ph: ph,
    rh: rh,
    msg1: inputs.msg1,
    msg2: inputs.msg2,
    msg3: inputs.msg3,
    h2: inputs.h2,
    h3: inputs.h3,
    r4h: inputs.r4h,
    a2: inputs.a2,
    a3: inputs.a3,
    root: inputs.root,
    proof: inputs.proof,
    hubRegistry: inputs.hubRegistry,
    pubkeyC: inputs.pubkeyC,
    pubkeyHub: inputs.pubkeyHub,
    sigJoinMsgC: inputs.sigJoinMsgC,
    sigJoinMsgHub: inputs.sigJoinMsgHub,
    pubkeyAdmin: inputs.pubkeyAdmin,
    pubkeyA: pubkeyA,
    sigRh: sigRh
  };
};
