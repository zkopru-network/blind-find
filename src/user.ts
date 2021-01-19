import { Keypair, PubKey, Signature } from "maci-crypto";
import { getJoinHubMsgHashedData, signMsg } from ".";
import {
  genProofSuccessfulSMP,
  verifyProofIndirectConnection,
  verifyProofOfSMP,
  TProofIndirectConnection
} from "./circuits/ts";
import { TIMEOUT, TIMEOUT_LARGE } from "./configs";
import { DBMap } from "./db";
import { sendJoinHubReq, sendSearchReq } from "./hub";
import { IAtomicDB } from "./interfaces";
import { InvalidProof } from "./smp/exceptions";
import { TEthereumAddress } from "./types";
import { hashPointToScalar } from "./utils";

type TJoinedHubEntry = {
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
  // NOTE: merkleRoot should be updatable. Also, it can be a list.
  // TODO: merkleRoot should be changed to a merkleRoot service later, fetching merkleRoots
  //  from the contract.
  joinedHubsDB: TJoinedHubDB;

  constructor(
    readonly keypair: Keypair,
    readonly adminAddress: TEthereumAddress,
    readonly merkleRoot: BigInt,
    db: IAtomicDB,
    readonly timeoutSmall = TIMEOUT,
    readonly timeoutLarge = TIMEOUT_LARGE
  ) {
    this.joinedHubsDB = new DBMap(JOINED_HUBS_PREFIX, db);
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

  // TODO: Should we save the search result?
  async search(
    ip: string,
    port: number,
    target: PubKey
  ): Promise<TProofIndirectConnection | null> {
    const res = await sendSearchReq(
      ip,
      port,
      target,
      this.timeoutSmall,
      this.timeoutLarge
    );
    if (res === null) {
      return null;
    }
    // One peer matched. Verify the proof.
    const isProofOfSMPValid = await verifyProofOfSMP(res.proofOfSMP);
    if (!isProofOfSMPValid) {
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
      merkleRoot: this.merkleRoot,
      proofOfSMP: res.proofOfSMP,
      proofSuccessfulSMP
    };
    if (!(await verifyProofIndirectConnection(proofIndirectConnection))) {
      throw new InvalidProof("proof of indirect connection is invalid");
    }
    return proofIndirectConnection;
  }

  async getJoinedHubs() {
    const joinedHubs: Array<TJoinedHubEntry> = [];
    for await (const entry of this.joinedHubsDB) {
      joinedHubs.push(entry);
    }
    return joinedHubs;
  }

  private getDBEntryKey(hubPubkey: PubKey): string {
    return hashPointToScalar(hubPubkey).toString();
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
