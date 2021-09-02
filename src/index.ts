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
import { hashPointToScalar, isPubkeySame } from "./utils";

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
// should be 15775140326275327636461277643630368659324521625749033424352920874919079558886
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

const sortPubkeys = (pubkey0: PubKey, pubkey1: PubKey): [PubKey, PubKey] => {
  const scalar0 = hashPointToScalar(pubkey0);
  const scalar1 = hashPointToScalar(pubkey1);
  if (scalar0 <= scalar1) {
    return [pubkey0, pubkey1];
  } else {
    return [pubkey1, pubkey0];
  }
}

type TDataWithPubkey<T> = {
  pubkey: PubKey;
  data: T;
};

export const sortDataWithPubkey = <T>(
    dataWithPubkey0: TDataWithPubkey<T>,
    dataWithPubkey1: TDataWithPubkey<T>,
): [TDataWithPubkey<T>, TDataWithPubkey<T>] => {
  const sortedPubkeys = sortPubkeys(dataWithPubkey0.pubkey, dataWithPubkey1.pubkey);
  if (
    isPubkeySame(sortedPubkeys[0], dataWithPubkey0.pubkey) &&
    isPubkeySame(sortedPubkeys[1], dataWithPubkey1.pubkey)
  ) {
    return [dataWithPubkey0, dataWithPubkey1];
  } else if (
    isPubkeySame(sortedPubkeys[0], dataWithPubkey1.pubkey) &&
    isPubkeySame(sortedPubkeys[1], dataWithPubkey0.pubkey)
  ) {
    return [dataWithPubkey1, dataWithPubkey0];
  } else {
    throw new Error('sortedPubkeys mismatch the original ones')
  }
}

export const getHubConnectionHashedData = (
  hubPubkey0: PubKey,
  hubPubkey1: PubKey,
): BigInt => {
  const [sortedPubkey0, sortedPubkey1] = sortPubkeys(hubPubkey0, hubPubkey1);
  return hash5([
    prefixHubConnection,
    sortedPubkey0[0],
    sortedPubkey0[1],
    sortedPubkey1[0],
    sortedPubkey1[1],
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
    private readonly obj: THubRegistryObj
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
  protected _leaves: ILeafEntry<T>[];
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
  // TODO: Sort data in constructor?
  constructor(
    private readonly obj: THubConnectionObj
  ) {
  }

  verify(): boolean {
    const sorted = this.toSorted();
    const signingMsg = getHubConnectionHashedData(sorted.hubPubkey0, sorted.hubPubkey1);
    return (
      verifySignedMsg(signingMsg, sorted.hubSig0, sorted.hubPubkey0) &&
      verifySignedMsg(signingMsg, sorted.hubSig1, sorted.hubPubkey1)
    );
  }

  static partialSign(keypair: Keypair, another: PubKey): Signature {
    const signingMsg = getHubConnectionHashedData(keypair.pubKey, another);
    return signMsg(keypair.privKey, signingMsg);
  }

  hash(): BigInt {
    const sorted = this.toSorted();
    return hash11([
      sorted.hubSig0.R8[0],
      sorted.hubSig0.R8[1],
      sorted.hubSig0.S,
      sorted.hubPubkey0[0],
      sorted.hubPubkey0[1],
      sorted.hubSig1.R8[0],
      sorted.hubSig1.R8[1],
      sorted.hubSig1.S,
      sorted.hubPubkey1[0],
      sorted.hubPubkey1[1],
    ]);
  }

  toSorted(): THubConnectionObj {
    const obj = this.toObj();
    const sorted = sortDataWithPubkey<Signature>(
      { pubkey: obj.hubPubkey0, data: obj.hubSig0 },
      { pubkey: obj.hubPubkey1, data: obj.hubSig1 },
    );
    return {
      hubPubkey0: sorted[0].pubkey,
      hubPubkey1: sorted[1].pubkey,
      hubSig0: sorted[0].data,
      hubSig1: sorted[1].data,
    };
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
