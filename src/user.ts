import { Keypair, PubKey, Signature } from "maci-crypto";
import { getJoinHubMsgHashedData, signMsg } from ".";
import {
  genProofSuccessfulSMP,
  verifyProofIndirectConnection,
  verifyProofOfSMP,
  TProofIndirectConnection,
} from "./circuits";
import { MAX_INTERMEDIATE_HUBS, TIMEOUT, TIMEOUT_LARGE } from "./configs";
import { DBMap } from "./db";
import { sendJoinHubReq, sendSearchReq } from "./hub";
import { IAtomicDB } from "./interfaces";
import { InvalidProof } from "./smp/exceptions";
import { Scalar } from "./smp/v4/serialization";
import { TEthereumAddress } from "./types";
import { hashPointToScalar } from "./utils";
import { BlindFindContract } from "./web3";

export type TJoinedHubEntry = {
  ip: string;
  port: number;
  userPubkey: PubKey;
  userSig: Signature;
  hubPubkey: PubKey;
  hubSig: Signature;
};
type TJoinedHubDB = DBMap<TJoinedHubEntry>;

const JOINED_HUBS_PREFIX = "blind-find-user-joined-hubs";

export class User {
  joinedHubsDB: TJoinedHubDB;
  maxKeyLength = Scalar.size * 2;

  constructor(
    readonly keypair: Keypair,
    readonly adminAddress: TEthereumAddress,
    readonly contract: BlindFindContract,
    db: IAtomicDB,
    readonly timeoutSmall = TIMEOUT,
    readonly timeoutLarge = TIMEOUT_LARGE
  ) {
    this.joinedHubsDB = new DBMap(JOINED_HUBS_PREFIX, db, this.maxKeyLength);
  }

  async join(ip: string, port: number, hubPubkey: PubKey) {
    const joinMsg = getJoinHubMsgHashedData(this.keypair.pubKey, hubPubkey);
    const sig = signMsg(this.keypair.privKey, joinMsg);
    const hubSig = await sendJoinHubReq(
      ip,
      port,
      this.keypair.pubKey,
      sig,
      hubPubkey
    );
    await this.saveJoinedHub(ip, port, sig, hubPubkey, hubSig);
  }

  async search(
    ip: string,
    port: number,
    target: PubKey,
  ): Promise<TProofIndirectConnection | undefined> {
    const validHubRegistryTreeRoots = await this.contract.getAllHubRegistryTreeRoots();
    const validHubConnectionTreeRoots = await this.contract.getAllHubConnectionTreeRoots();
    const res = await sendSearchReq(
      ip,
      port,
      target,
      [],
      validHubRegistryTreeRoots,
      validHubConnectionTreeRoots,
      MAX_INTERMEDIATE_HUBS,
      this.timeoutSmall,
      this.timeoutLarge
    );
    if (res === undefined) {
      return undefined;
    }
    // One peer matched. Verify the proof.
    if (!(await verifyProofOfSMP(res.proofOfSMP))) {
      throw new InvalidProof("proof of smp is invalid");
    }
    // Construct Proof of Successful SMP
    const sigRh = signMsg(
      this.keypair.privKey,
      hashPointToScalar(res.rh.point)
    );
    const proofSuccessfulSMP = await genProofSuccessfulSMP({
      a3: res.a3,
      pa: res.pa,
      ph: res.ph,
      rh: res.rh,
      pubkeyA: this.keypair.pubKey,
      sigRh
    });
    const proofIndirectConnection = {
      pubkeyA: this.keypair.pubKey,
      pubkeyC: target,
      adminAddress: this.adminAddress,
      proofOfSMP: res.proofOfSMP,
      proofSuccessfulSMP,
      proofSaltedConnections: [],
    };
    if (!await verifyProofIndirectConnection(proofIndirectConnection, validHubRegistryTreeRoots, validHubConnectionTreeRoots)) {
      throw new InvalidProof("proof of indirect connection is invalid");
    }
    return proofIndirectConnection;
  }

  async getJoinedHubs() {
    const joinedHubs: Array<TJoinedHubEntry> = [];
    for await (const entry of this.joinedHubsDB) {
      joinedHubs.push(entry.value);
    }
    return joinedHubs;
  }

  private getDBEntryKey(hubPubkey: PubKey): string {
    const key = hashPointToScalar(hubPubkey).toString(16);
    if (key.length > this.maxKeyLength) {
      throw new Error(
        `key length is larger than maxKeyLength: key.length=${key.length}, maxKeyLength=${this.maxKeyLength}`
      );
    }
    return key;
  }

  private async saveJoinedHub(
    ip: string,
    port: number,
    userSig: Signature,
    hubPubkey: PubKey,
    hubSig: Signature
  ) {
    const entry: TJoinedHubEntry = {
      ip,
      port,
      userSig,
      userPubkey: this.keypair.pubKey,
      hubPubkey,
      hubSig
    };
    await this.joinedHubsDB.set(this.getDBEntryKey(hubPubkey), entry);
  }
}
