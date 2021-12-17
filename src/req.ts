import { PubKey, Signature } from "maci-crypto";
import { logger } from "./logger";
import { getCounterSignHashedData, verifySignedMsg } from ".";
import { RequestFailed } from "./exceptions";
import {
  JoinReq,
  JoinResp,
  SearchMessage0,
  SearchMessage1,
  SearchMessage3,
  msgType
} from "./serialization";
import { TLV, Short } from "./smp/serialization";
import { connect } from "./websocket";
import { TIMEOUT, MAXIMUM_TRIALS, TIMEOUT_LARGE } from "./configs";
import { SMPStateMachine } from "./smp";
import { hashPointToScalar } from "./utils";
import { TProof } from "./circuits";
import { SMPState1 } from "./smp/state";
import { SMPMessage2Wire, SMPMessage3Wire } from "./smp/v4/serialization";
import { BabyJubPoint } from "./smp/v4/babyJub";

type TSMPResult = {
  a3: BigInt;
  pa: BabyJubPoint;
  ph: BabyJubPoint;
  rh: BabyJubPoint;
  proofOfSMP: TProof;
};

export const sendJoinHubReq = async (
  ip: string,
  port: number,
  userPubkey: PubKey,
  userSig: Signature,
  hubPubkey: PubKey,
  timeout: number = TIMEOUT
): Promise<Signature> => {
  const rwtor = await connect(ip, port);
  const joinReq = new JoinReq(userPubkey, userSig);
  const req = new TLV(new Short(msgType.JoinReq), joinReq.serialize());
  rwtor.write(req.serialize());
  const respBytes = await rwtor.read(timeout);
  const resp = JoinResp.deserialize(respBytes);
  const hasedData = getCounterSignHashedData(userSig);
  if (!verifySignedMsg(hasedData, resp.hubSig, hubPubkey)) {
    throw new RequestFailed("hub signature is invalid");
  }
  return resp.hubSig;
};

export const sendSearchReq = async (
  ip: string,
  port: number,
  target: PubKey,
  timeoutSmall: number = TIMEOUT,
  timeoutLarge: number = TIMEOUT_LARGE,
  maximumTrial: number = MAXIMUM_TRIALS
): Promise<TSMPResult | null> => {
  const rwtor = await connect(ip, port);

  const msg0 = new SearchMessage0();
  const req = new TLV(new Short(msgType.SearchReq), msg0.serialize());
  rwtor.write(req.serialize());

  let smpRes: TSMPResult | null = null;
  let numTrials = 0;

  const secret = hashPointToScalar(target);

  while (numTrials < maximumTrial) {
    logger.debug(
      `sendSearchReq: starting trial ${numTrials}, waiting for msg1 from the server`
    );
    const stateMachine = new SMPStateMachine(secret);
    const a3 = (stateMachine.state as SMPState1).s3;
    const msg1Bytes = await rwtor.read(timeoutSmall);
    const msg1 = SearchMessage1.deserialize(msg1Bytes);
    logger.debug("sendSearchReq: received msg1");
    // Check if there is no more candidates.
    if (msg1.isEnd) {
      break;
    }
    if (msg1.smpMsg1 === undefined) {
      throw new Error(
        "this should never happen, constructor already handles it for us"
      );
    }
    const msg2 = stateMachine.transit(msg1.smpMsg1);
    if (msg2 === null) {
      throw new Error("this should never happen");
    }
    logger.debug("sendSearchReq: sending msg2");
    rwtor.write(msg2.serialize());
    const msg3Bytes = await rwtor.read(timeoutLarge);
    logger.debug("sendSearchReq: received msg3");
    const msg3 = SearchMessage3.deserialize(msg3Bytes);
    stateMachine.transit(msg3.smpMsg3);
    if (!stateMachine.isFinished()) {
      throw new RequestFailed(
        "smp should have been finished. there must be something wrong"
      );
    }
    if (stateMachine.getResult()) {
      logger.debug(`sendSearchReq: SMP has matched, target=${target} is found`);
      const pa = SMPMessage2Wire.fromTLV(msg2).pb;
      const smpMsg3 = SMPMessage3Wire.fromTLV(msg3.smpMsg3);
      const ph = smpMsg3.pa;
      const rh = smpMsg3.ra;
      smpRes = {
        a3,
        pa,
        ph,
        rh,
        proofOfSMP: msg3.proof
      };
    }
    numTrials++;
  }
  return smpRes;
};
