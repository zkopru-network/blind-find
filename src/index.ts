import BN from "bn.js";
import { sha256 } from "js-sha256";
import {
  hash11,
  hash5,
  PrivKey,
  PubKey,
  sign,
  Signature,
  SNARK_FIELD_SIZE,
  verifySignature,
  IncrementalQuinTree,
  Keypair
} from "maci-crypto";

import { PREFIX_JOIN, PREFIX_REGISTER_NEW_HUB } from "./constants";
import { ValueError } from "./smp/exceptions";
import { bigIntMod } from "./smp/utils";
import { LEVELS, ZERO_VALUE } from "./configs";
import { TEthereumAddress } from "./types";

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

const getRegisterNewHubHashedData = (
  adminAddress: TEthereumAddress
): TEthereumAddress => {
  return hash5([
    prefixRegisterNewHub,
    adminAddress,
    BigInt(0),
    BigInt(0),
    BigInt(0)
  ]);
};

const getJoinHubMsgHashedData = (
  userPubkey: PubKey,
  hubPubkey: PubKey
): BigInt => {
  return hash5([
    prefixJoinMsg,
    userPubkey[0],
    userPubkey[1],
    hubPubkey[0],
    hubPubkey[1]
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
  constructor(
    readonly sig: Signature,
    readonly pubkey: PubKey,
    readonly adminAddress: TEthereumAddress
  ) {}

  static fromKeypair(keypair: Keypair, adminAddress: TEthereumAddress) {
    const sig = signMsg(
      keypair.privKey,
      getRegisterNewHubHashedData(adminAddress)
    );
    return new HubRegistry(sig, keypair.pubKey, adminAddress);
  }

  verify(): boolean {
    const signingMsg = getRegisterNewHubHashedData(this.adminAddress);
    return verifySignedMsg(signingMsg, this.sig, this.pubkey);
  }

  hash() {
    return hash11([
      this.sig.R8[0],
      this.sig.R8[1],
      this.sig.S,
      this.pubkey[0],
      this.pubkey[1],
      this.adminAddress
    ]);
  }
}

class HubRegistryTree {
  leaves: HubRegistry[];
  tree: IncrementalQuinTree;
  private mapHashToIndex: Map<BigInt, number>;

  constructor(levels = LEVELS) {
    this.tree = new IncrementalQuinTree(levels, ZERO_VALUE, 2);
    this.leaves = [];
    this.mapHashToIndex = new Map<BigInt, number>();
  }

  public get length() {
    return this.leaves.length;
  }

  insert(e: HubRegistry) {
    if (!e.verify()) {
      throw new ValueError(`registry is not valid: e=${e}`);
    }
    const registryHash = e.hash();
    const index = this.leaves.length;
    this.leaves.push(e);
    this.tree.insert(registryHash);
    this.mapHashToIndex.set(registryHash, index);
  }

  getIndex(e: HubRegistry): number | undefined {
    const key = e.hash();
    return this.mapHashToIndex.get(key);
  }
}

export {
  signMsg,
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getCounterSignHashedData,
  getRegisterNewHubHashedData,
  HubRegistryTree,
  HubRegistry
};
