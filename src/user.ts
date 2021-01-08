import { Keypair, PubKey } from "maci-crypto";
import { getJoinHubMsgHashedData, signMsg } from ".";
import {
  genProofSuccessfulSMP,
  verifyProofIndirectConnection,
  verifyProofOfSMP,
  TProofIndirectConnection
} from "./circuits/ts";
import { TIMEOUT, TIMEOUT_LARGE } from "./configs";
import { sendJoinHubReq, sendSearchReq } from "./hub";
import { InvalidProof } from "./smp/exceptions";
import { TEthereumAddress } from "./types";
import { hashPointToScalar } from "./utils";

export class User {
  // NOTE: merkleRoot should be updatable. Also, it can be a list.
  // TODO: This should be changed to a merkleRoot service later, fetching merkleRoots
  //  from the contract.
  merkleRoot: BigInt;
  // TODO: Add `JoinedHub`s

  constructor(
    readonly keypair: Keypair,
    readonly adminAddress: TEthereumAddress,
    merkleRoot: BigInt,
    readonly timeoutSmall = TIMEOUT,
    readonly timeoutLarge = TIMEOUT_LARGE
  ) {
    this.merkleRoot = merkleRoot;
  }

  async join(ip: string, port: number, hubPubkey: PubKey) {
    const joinMsg = getJoinHubMsgHashedData(this.keypair.pubKey, hubPubkey);
    const sig = signMsg(this.keypair.privKey, joinMsg);
    // TODO: Store the countersigned signature from the hub.
    await sendJoinHubReq(ip, port, this.keypair.pubKey, sig, hubPubkey);
  }

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
}
