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

import { PREFIX_JOIN, PREFIX_REGISTER_NEW_HUB, PREFIX_HUB_CONNECTION } from "./constants";
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
const prefixHubConnection = hashStringToField(PREFIX_HUB_CONNECTION);

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

const getHubConnectionHashedData = (
  hubPubkey0: PubKey,
  hubPubkey1: PubKey,
): BigInt => {
  return hash5([
    prefixHubConnection,
    hubPubkey0[0],
    hubPubkey0[1],
    hubPubkey1[0],
    hubPubkey1[1]
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

interface ILeafEntry {
  hash(): BigInt;
}

class HubRegistry implements ILeafEntry {
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

  hash(): BigInt {
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

class MerkleTree<T extends ILeafEntry> {
  leaves: T[];
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

  insert(e: T) {
    const registryHash = e.hash();
    const index = this.leaves.length;
    this.leaves.push(e);
    this.tree.insert(registryHash);
    this.mapHashToIndex.set(registryHash, index);
  }

  getIndex(e: T): number | undefined {
    const key = e.hash();
    return this.mapHashToIndex.get(key);
  }
}

class HubRegistryTree extends MerkleTree<HubRegistry> {
}


class HubConnectionRegistry implements ILeafEntry {
  constructor(
    readonly hubPubkey0: PubKey,
    readonly hubSig0: Signature,
    readonly hubPubkey1: PubKey,
    readonly hubSig1: Signature,
  ) {}

  static fromKeypairs(hubKeypair0: Keypair, hubKeypair1: Keypair) {
    const hubPubkey0 = hubKeypair0.pubKey;
    const hubPubkey1 = hubKeypair1.pubKey;
    const signingData = getHubConnectionHashedData(hubPubkey0, hubPubkey1);
    const hubSig0 = signMsg(
      hubKeypair0.privKey,
      signingData,
    );
    const hubSig1 = signMsg(
      hubKeypair1.privKey,
      signingData,
    );
    return new HubConnectionRegistry(hubPubkey0, hubSig0, hubPubkey1, hubSig1);
  }

  verify(): boolean {
    const signingMsg = getHubConnectionHashedData(this.hubPubkey0, this.hubPubkey1);
    return (
      verifySignedMsg(signingMsg, this.hubSig0, this.hubPubkey0) &&
      verifySignedMsg(signingMsg, this.hubSig1, this.hubPubkey1)
    );
  }

  hash(): BigInt {
    return hash11([
      this.hubSig0.R8[0],
      this.hubSig0.R8[1],
      this.hubSig0.S,
      this.hubPubkey0[0],
      this.hubPubkey0[1],
      this.hubSig1.R8[0],
      this.hubSig1.R8[1],
      this.hubSig1.S,
      this.hubPubkey1[0],
      this.hubPubkey1[1],
    ]);
  }
}

class HubConnectionTree extends MerkleTree<HubConnectionRegistry> {
}


export {
  signMsg,
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getCounterSignHashedData,
  getRegisterNewHubHashedData,
  HubRegistryTree,
  HubRegistry,
  HubConnectionTree,
  HubConnectionRegistry
};
