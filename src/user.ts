import { Keypair, PubKey, Signature } from "maci-crypto";
import { getJoinHubMsgHashedData, signMsg } from ".";
import {
  genProofSuccessfulSMP,
  verifyProofIndirectConnection,
  verifyProofOfSMP,
  TProofIndirectConnection
} from "./circuits";
import { BlindFindConfig, IOptions, IRawOptions } from "./cli/configs";
import { TIMEOUT, TIMEOUT_LARGE } from "./configs";
import { DBMap, MemoryDB } from "./db";
import { sendJoinHubReq, sendSearchReq } from "./req";
import { IAtomicDB } from "./interfaces";
import { InvalidProof } from "./smp/exceptions";
import { Scalar } from "./smp/v4/serialization";
import { TEthereumAddress, THost } from "./types";
import {
  bigIntToHexString,
  hashPointToScalar,
  unstringifyBigInts
} from "./utils";
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

  static async fromOption(rawOption: IRawOptions): Promise<User> {
    const option = {
      ...rawOption,
      blindFindPrivkey: unstringifyBigInts(rawOption.blindFindPrivkey)
    };
    const config = new BlindFindConfig(option, "/");
    const keypair = config.getKeypair();
    const contract = config.getBlindFindContract();
    const adminAddress = await contract.getAdmin();

    const db = new MemoryDB();

    return new User(keypair, adminAddress, contract, db);
  }

  async join(ip: string, port: number, hubPubkey: PubKey, userHost: THost) {
    const joinMsg = getJoinHubMsgHashedData(this.keypair.pubKey, hubPubkey);
    const sig = signMsg(this.keypair.privKey, joinMsg);
    const hubSig = await sendJoinHubReq(
      ip,
      port,
      this.keypair.pubKey,
      sig,
      userHost,
      hubPubkey
    );
    await this.saveJoinedHub(ip, port, sig, hubPubkey, hubSig);
  }

  async search(
    ip: string,
    port: number,
    target: PubKey
  ): Promise<(TProofIndirectConnection & { userHost: THost }) | null> {
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
      userHost: res.userHost
    };
    if (
      !(await this.verifyProofOfIndirectConnection(proofIndirectConnection))
    ) {
      throw new InvalidProof("proof of indirect connection is invalid");
    }
    return proofIndirectConnection;
  }

  async verifyProofOfIndirectConnection(
    proof: TProofIndirectConnection
  ): Promise<boolean> {
    const validMerkleRoots = await this.contract.getAllMerkleRoots();
    return await verifyProofIndirectConnection(proof, validMerkleRoots);
  }

  async getJoinedHubs() {
    const joinedHubs: Array<TJoinedHubEntry> = [];
    for await (const entry of this.joinedHubsDB) {
      joinedHubs.push(entry.value);
    }
    return joinedHubs;
  }

  private getDBEntryKey(hubPubkey: PubKey): string {
    const key = bigIntToHexString(hashPointToScalar(hubPubkey));
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
