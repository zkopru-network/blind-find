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

interface ILeafEntry<T extends Object> {
  hash(): BigInt;
  toObj(): T;
}

type THubRegistryObj = {
  sig: Signature;
  pubkey: PubKey;
  adminAddress: TEthereumAddress;
};

class HubRegistry implements ILeafEntry<THubRegistryObj> {
  constructor(
    readonly obj: THubRegistryObj
  ) {}

  static fromKeypair(keypair: Keypair, adminAddress: TEthereumAddress) {
    const sig = signMsg(
      keypair.privKey,
      getRegisterNewHubHashedData(adminAddress)
    );
    return new HubRegistry({
      sig: sig,
      pubkey: keypair.pubKey,
      adminAddress: adminAddress
    });
  }

  verify(): boolean {
    const signingMsg = getRegisterNewHubHashedData(this.obj.adminAddress);
    return verifySignedMsg(signingMsg, this.obj.sig, this.obj.pubkey);
  }

  hash(): BigInt {
    return hash11([
      this.obj.sig.R8[0],
      this.obj.sig.R8[1],
      this.obj.sig.S,
      this.obj.pubkey[0],
      this.obj.pubkey[1],
      this.obj.adminAddress
    ]);
  }

  toObj() {
    return this.obj;
  }
}

class IncrementalSMT<T extends Object> {
  _leaves: ILeafEntry<T>[];
  tree: IncrementalQuinTree;
  private mapHashToIndex: Map<BigInt, number>;

  constructor(levels = LEVELS) {
    this.tree = new IncrementalQuinTree(levels, ZERO_VALUE, 2);
    this._leaves = [];
    this.mapHashToIndex = new Map<BigInt, number>();
  }

  public get length() {
    return this._leaves.length;
  }

  insert(e: ILeafEntry<T>) {
    const registryHash = e.hash();
    const index = this._leaves.length;
    this._leaves.push(e);
    this.tree.insert(registryHash);
    this.mapHashToIndex.set(registryHash, index);
  }

  getIndex(e: ILeafEntry<T>): number | undefined {
    const key = e.hash();
    return this.mapHashToIndex.get(key);
  }
}

class HubRegistryTree extends IncrementalSMT<THubRegistryObj> {
  public get leaves(): Array<HubRegistry> {
    return this._leaves as Array<HubRegistry>;
  }
  insert(e: HubRegistry) {
    return super.insert(e);
  }
  getIndex(e: HubRegistry) {
    return super.getIndex(e);
  }
}

type THubConnectionObj = {
  hubPubkey0: PubKey;
  hubSig0: Signature;
  hubPubkey1: PubKey;
  hubSig1: Signature;
}

class HubConnectionRegistry implements ILeafEntry<THubConnectionObj> {
  constructor(
    readonly obj: THubConnectionObj
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
    return new HubConnectionRegistry({
      hubPubkey0,
      hubSig0,
      hubPubkey1,
      hubSig1,
    });
  }

  verify(): boolean {
    const signingMsg = getHubConnectionHashedData(this.obj.hubPubkey0, this.obj.hubPubkey1);
    return (
      verifySignedMsg(signingMsg, this.obj.hubSig0, this.obj.hubPubkey0) &&
      verifySignedMsg(signingMsg, this.obj.hubSig1, this.obj.hubPubkey1)
    );
  }

  hash(): BigInt {
    return hash11([
      this.obj.hubSig0.R8[0],
      this.obj.hubSig0.R8[1],
      this.obj.hubSig0.S,
      this.obj.hubPubkey0[0],
      this.obj.hubPubkey0[1],
      this.obj.hubSig1.R8[0],
      this.obj.hubSig1.R8[1],
      this.obj.hubSig1.S,
      this.obj.hubPubkey1[0],
      this.obj.hubPubkey1[1],
    ]);
  }

  toObj(): THubConnectionObj {
    return this.obj;
  }
}

class HubConnectionRegistryTree extends IncrementalSMT<THubConnectionObj> {
  public get leaves(): Array<HubConnectionRegistry> {
    return this._leaves as Array<HubConnectionRegistry>;
  }
  insert(e: HubConnectionRegistry) {
    return super.insert(e);
  }
  getIndex(e: HubConnectionRegistry) {
    return super.getIndex(e);
  }
}

export {
  signMsg,
  verifySignedMsg,
  getJoinHubMsgHashedData,
  getCounterSignHashedData,
  getRegisterNewHubHashedData,
  IncrementalSMT,
  HubRegistry,
  HubConnectionRegistry,
  THubRegistryObj,
  THubConnectionObj,
  ILeafEntry,
  HubRegistryTree,
  HubConnectionRegistryTree,
};
