import * as http from "http";
import { hash5, Keypair, PubKey, Signature } from "maci-crypto";
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

// TODO: Should be moved to `serialization.ts`?
enum requestType {
  JoinReq = 6,
  SearchReq
}

type TUserRegistry = { userSig: Signature; hubSig: Signature };
type TUserStoreMap = Map<BigInt, TUserRegistry>;
type TUserStorePubkeyMap = Map<BigInt, PubKey>;

interface IUserStore {
  get(pubkey: PubKey): TUserRegistry | undefined;
  set(pubkey: PubKey, registry: TUserRegistry): void;
  size: number;
}

/**
 * `UserStore` stores the mapping from `Pubkey` to `TUserRegistry`.
 * It is implemented because NodeJS doesn't work well with Array-typed keys.
 */
export class UserStore implements IUserStore {
  private mapStore: TUserStoreMap;
  private mapPubkey: TUserStorePubkeyMap;

  constructor() {
    this.mapStore = new Map<BigInt, TUserRegistry>();
    this.mapPubkey = new Map<BigInt, PubKey>();
  }

  public get size() {
    return this.mapStore.size;
  }

  private hash(pubkey: PubKey): BigInt {
    return hash5([pubkey[0], pubkey[1], BigInt(0), BigInt(0), BigInt(0)]);
  }

  get(pubkey: PubKey) {
    return this.mapStore.get(this.hash(pubkey));
  }

  set(pubkey: PubKey, registry: TUserRegistry) {
    const pubkeyHash = this.hash(pubkey);
    this.mapPubkey.set(pubkeyHash, pubkey);
    this.mapStore.set(pubkeyHash, registry);
  }

  forEach(callbackFn: (value: TUserRegistry, key: PubKey) => void): void {
    this.mapStore.forEach((value, key, map) => {
      const pubkey = this.mapPubkey.get(key);
      if (pubkey === undefined) {
        throw new Error("pubkey shouldn't be undefined");
      }
      callbackFn(value, pubkey);
    });
  }
}

// TODO: Probably we can use `close.code` to indicate the reason why a socket is closed by
//  the server.
//  Ref: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
/**
 * `HubServer` is run by Hubs. The server receives requests and send the corresponding
 *  response to the users.
 */
export class HubServer extends BaseServer {
  userStore: IUserStore;

  constructor(readonly keypair: Keypair, userStore?: IUserStore) {
    super();
    if (userStore !== undefined) {
      this.userStore = userStore;
    } else {
      this.userStore = new UserStore();
    }
  }

  onJoinRequest(socket: WebSocket, bytes: Uint8Array) {
    console.debug("server: onJoinRequest");
    const req = JoinReq.deserialize(bytes);
    const hashedData = getCounterSignHashedData(req.userSig);
    const hubSig = signMsg(this.keypair.privKey, hashedData);
    socket.send(new JoinResp(hubSig).serialize());
    this.userStore.set(req.userPubkey, {
      userSig: req.userSig,
      hubSig: hubSig
    });
  }

  onSearchRequest(socket: WebSocket, bytes: Uint8Array) {
    console.debug("server: onSearchRequest");
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    // Delegate to the corresponding handler
    socket.onmessage = event => {
      const tlv = TLV.deserialize(event.data as Buffer);
      const tlvType = bigIntToNumber(tlv.type.value);

      const remoteAddress = request.connection.remoteAddress;
      if (remoteAddress !== undefined) {
        console.info(`server: incoming connection from ${remoteAddress}, type=${tlvType}`);
      } else {
        console.info(`server: incoming connection from unknown address, type=${tlvType}`);
      }
      switch (tlvType) {
        case requestType.JoinReq:
          this.onJoinRequest(socket, tlv.value);
          socket.close();
          break;
        case requestType.SearchReq:
          this.onSearchRequest(socket, tlv.value);
          socket.close();
          break;
        default:
          console.error(`type ${tlvType} is unsupported`);
          socket.terminate();
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
