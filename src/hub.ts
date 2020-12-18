import * as http from "http";
import { Keypair, PubKey, Signature } from "maci-crypto";
import WebSocket from "ws";

import { getCounterSignHashedData, signMsg, verifySignedMsg } from ".";
import { RequestFailed, UnsupportedRequest } from "./exceptions";
import { JoinReq, JoinResp } from "./serialization";
import { TLV, Short } from "./smp/serialization";
import { bigIntToNumber } from "./smp/utils";
import {
  BaseServer,
  WS_PROTOCOL,
  request,
  waitForSocketOpen
} from "./websocket";
import { TIMEOUT } from "./configs";

enum requestType {
  JoinReq = 6,
  SearchReq
}

type TUserRegistry = { userSig: Signature; hubSig: Signature };
type TUserStore = Map<PubKey, TUserRegistry>;

export class Hub extends BaseServer {
  userStore: TUserStore;
  constructor(readonly keypair: Keypair, userStore?: TUserStore) {
    super();
    if (userStore !== undefined) {
      this.userStore = userStore;
    } else {
      this.userStore = new Map<PubKey, TUserRegistry>();
    }
  }

  onJoinRequest(socket: WebSocket, bytes: Uint8Array) {
    console.log("server: onJoinRequest");
    const req = JoinReq.deserialize(bytes);
    const hashedData = getCounterSignHashedData(req.userSig);
    const hubSig = signMsg(this.keypair.privKey, hashedData);
    this.userStore.set(req.userPubkey, {
      userSig: req.userSig,
      hubSig: hubSig
    });
    socket.send(new JoinResp(hubSig).serialize());
    socket.close();
  }

  onSearchRequest(socket: WebSocket, bytes: Uint8Array) {}

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    console.log("server: onIncoming");
    // Delegate to the corresponding handler
    socket.onmessage = event => {
      const tlv = TLV.deserialize(event.data as Buffer);
      const tlvType = bigIntToNumber(tlv.type.value);
      console.log(`server: onMessage, type=${tlvType}`);
      switch (tlvType) {
        case requestType.JoinReq:
          this.onJoinRequest(socket, tlv.value);
          break;
        case requestType.SearchReq:
          this.onSearchRequest(socket, tlv.value);
          break;
        default:
          throw new UnsupportedRequest(`type ${tlvType} is unsupported`);
      }
    };
  }
}

export const sendJoinHubReq = async (
  ip: string,
  port: number,
  userPubkey: PubKey,
  userSig: Signature,
  hubPubkey: PubKey,
  timeout: number = TIMEOUT
): Promise<Signature> => {
  const c = new WebSocket(`${WS_PROTOCOL}://${ip}:${port}`);

  // Wait until the socket is opened.
  await waitForSocketOpen(c);
  const joinReq = new JoinReq(userPubkey, userSig);
  const req = new TLV(new Short(requestType.JoinReq), joinReq.serialize());

  const messageHandler = (data: Uint8Array): JoinResp => {
    const resp = JoinResp.deserialize(data);
    const hasedData = getCounterSignHashedData(userSig);
    if (!verifySignedMsg(hasedData, resp.hubSig, hubPubkey)) {
      throw new RequestFailed("hub signature is invalid");
    }
    return resp;
  };
  const resp = await request(c, req.serialize(), messageHandler, timeout);
  c.close();
  return resp.hubSig;
};
