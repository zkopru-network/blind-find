import BN from "bn.js";
import { sha256 } from "js-sha256";
import {
  hash11,
  hash5,
  Keypair,
  PrivKey,
  PubKey,
  sign,
  Signature,
  SNARK_FIELD_SIZE,
  verifySignature,
  IncrementalQuinTree
} from "maci-crypto";

import { PREFIX_JOIN, PREFIX_REGISTER_NEW_HUB } from "./constants";
import { ValueError } from "./smp/exceptions";
import { bigIntMod } from "./smp/utils";

const hashStringToField = (s: string): BigInt => {
  return bigIntMod(
    BigInt(new BN(sha256(s), "hex").toString()),
    SNARK_FIELD_SIZE
  );
};

// should be 11174262654018418496616668956048135415153724061932452053335097373686592240616
const prefixJoinMsg = hashStringToField(PREFIX_JOIN);
// should be 1122637059787783884121270614611449342946993875255423905974201070879309325140
const prefixRegisterNewHub = hashStringToField(PREFIX_REGISTER_NEW_HUB);

const signMsg = (privkey: PrivKey, hashedData: BigInt): Signature => {
  return sign(privkey, hashedData);
};

const verifySignedMsg = (
  hashedData: BigInt,
  sig: Signature,
  pubkey: PubKey
): boolean => {
  return verifySignature(hashedData, sig, pubkey);
};

const getJoinHubMsgHashedData = (
  userPubkey: PubKey,
  adminPubkey: PubKey
): BigInt => {
  return hash5([
    prefixJoinMsg,
    userPubkey[0],
    userPubkey[1],
    adminPubkey[0],
    adminPubkey[1]
  ]);
};

const getCounterSignHashedData = (sigToBeCounterSigned: Signature): BigInt => {
  return hash5([
    sigToBeCounterSigned.R8[0],
    sigToBeCounterSigned.R8[1],
    sigToBeCounterSigned.S,
    BigInt(0),
    BigInt(0)
  ]);
};

class HubRegistry {
  sig: Signature;
  pubkey: PubKey;
  adminSig?: Signature;
  adminPubkey?: PubKey;

  constructor(
    sig: Signature,
    pubkey: PubKey,
    adminSig?: Signature,
    adminPubkey?: PubKey
  ) {
    this.sig = sig;
    this.pubkey = pubkey;
    this.adminSig = adminSig;
    this.adminPubkey = adminPubkey;
  }

  getSigningMsg() {
    return prefixRegisterNewHub;
  }

  verify(): boolean {
    if (this.adminSig === undefined || this.adminPubkey === undefined) {
      throw new ValueError("haven't been counter signed");
    }
    const isSigValid = verifySignedMsg(
      this.getSigningMsg(),
      this.sig,
      this.pubkey
    );
    const isAdminSigValid = verifySignedMsg(
      getCounterSignHashedData(this.sig),
      this.adminSig,
      this.adminPubkey
    );
    return isSigValid && isAdminSigValid;
  }

  adminSign(keypair: Keypair) {
    this.adminSig = signMsg(
      keypair.privKey,
      getCounterSignHashedData(this.sig)
    );
    this.adminPubkey = keypair.pubKey;
  }

  hash() {
    if (this.adminSig === undefined || this.adminPubkey === undefined) {
      throw new ValueError("haven't been counter signed");
    }
    return hash11([
      this.sig.R8[0],
      this.sig.R8[1],
      this.sig.S,
      this.pubkey[0],
      this.pubkey[1],
      this.adminSig.R8[0],
      this.adminSig.R8[1],
      this.adminSig.S,
      this.adminPubkey[0],
      this.adminPubkey[1]
    ]);
  }
}

const LEVELS = 32;
const ZERO_VALUE = 0;

class HubRegistryTree {
  leaves: HubRegistry[];
  tree: IncrementalQuinTree;

  constructor(levels = LEVELS) {
    this.tree = new IncrementalQuinTree(levels, ZERO_VALUE, 2);
    this.leaves = [];
  }

  public get length() {
    return this.leaves.length;
  }

  insert(e: HubRegistry) {
    if (!e.verify()) {
      throw new ValueError(`registry is not verified: e=${e}`);
    }
    this.leaves.push(e);
    this.tree.insert(e.hash());
  }
}

export {
  signMsg,
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getCounterSignHashedData,
  prefixRegisterNewHub,
  HubRegistryTree,
  HubRegistry
};
