import * as http from "http";
import { Keypair, PubKey, Signature } from "maci-crypto";
import WebSocket from "ws";

import { getCounterSignHashedData, signMsg, verifySignedMsg } from ".";
import { RequestFailed, SearchFinished } from "./exceptions";
import {
  JoinReq,
  JoinResp,
  SearchMessage0,
  SearchMessage1,
  SearchMessage2,
  SearchMessage3
} from "./serialization";
import { TLV, Short } from "./smp/serialization";
import { bigIntToNumber } from "./smp/utils";
import {
  BaseServer,
  WS_PROTOCOL,
  request,
  waitForSocketOpen
} from "./websocket";
import { TIMEOUT } from "./configs";
import { SMPStateMachine } from "./smp";
import { hashPointToScalar } from "./utils";

// TODO: Should be moved to `serialization.ts`?
enum requestType {
  JoinReq = 6,
  SearchReq
}

type TUserRegistry = { userSig: Signature; hubSig: Signature };
type TUserStoreMap = Map<BigInt, TUserRegistry>;
type TUserStorePubkeyMap = Map<BigInt, PubKey>;
type TIterItem = [PubKey, TUserRegistry];

interface IUserStore extends Iterable<TIterItem> {
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

  *[Symbol.iterator]() {
    // Shallow-copy the maps, to avoid race condition.
    const mapStoreCopied = new Map(this.mapStore);
    const mapPubkeyCopied = new Map(this.mapPubkey);
    for (const item of mapStoreCopied) {
      const pubkeyHash = item[0];
      const pubkey = mapPubkeyCopied.get(pubkeyHash);
      if (pubkey === undefined) {
        throw new Error("pubkey should be found");
      }
      yield [pubkey, item[1]] as TIterItem;
    }
  }

  private hash(pubkey: PubKey): BigInt {
    return hashPointToScalar(pubkey);
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

export const runSMPServer = async (
  socket: WebSocket,
  target: PubKey,
  timeout: number
) => {
  console.debug(`runSMPServer: running smp using ${target}`);
  const secret = hashPointToScalar(target);
  const stateMachine = new SMPStateMachine(secret);
  const smpMsg1 = stateMachine.transit(null);
  if (smpMsg1 === null) {
    throw new Error("smpMsg1tlv should not be null");
  }
  const msg1 = new SearchMessage1(false, smpMsg1);
  console.debug(`runSMPServer: sending msg1`);
  const msg2 = await request(
    socket,
    msg1.serialize(),
    data => SearchMessage2.deserialize(data),
    timeout
  );
  console.debug(`runSMPServer: received msg2`);
  const msg3 = stateMachine.transit(msg2);
  if (msg3 === null) {
    throw new Error("this should never happen");
  }
  console.debug(`runSMPServer: sending msg3`);
  socket.send(msg3.serialize());
};

export const runSMPClient = async (
  socket: WebSocket,
  target: PubKey,
  timeout: number
): Promise<boolean> => {
  console.debug(`runSMPClient: running smp using ${target}`);
  const secret = hashPointToScalar(target);
  const stateMachine = new SMPStateMachine(secret);
  const msg1 = await request(
    socket,
    undefined,
    data => SearchMessage1.deserialize(data),
    timeout
  );
  console.debug(`runSMPClient: received msg1`);
  // Check if there is no more candidates.
  // TODO: Add a check for maximum candidates, to avoid endless searching with the server.
  if (msg1.isEnd) {
    throw new SearchFinished();
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
  console.debug(`runSMPClient: sending msg2`);
  const msg3 = await request(
    socket,
    msg2.serialize(),
    data => SearchMessage3.deserialize(data),
    timeout
  );
  console.debug(`runSMPClient: received msg3`);
  stateMachine.transit(msg3);
  return stateMachine.getResult();
};

// TODO: Probably we can use `close.code` to indicate the reason why a socket is closed by
//  the server.
//  Ref: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
/**
 * `HubServer` is run by Hubs. The server receives requests and send the corresponding
 *  response to the users.
 */
export class HubServer extends BaseServer {
  // TODO: Add a lock to protect `userStore` from racing between tasks?
  userStore: IUserStore;
  timeout: number;

  constructor(
    readonly keypair: Keypair,
    userStore?: IUserStore,
    timeout = TIMEOUT
  ) {
    super();
    this.timeout = timeout;
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

  async onSearchRequest(socket: WebSocket, bytes: Uint8Array) {
    console.debug("server: onSearchRequest");
    // SearchMessage0
    SearchMessage0.deserialize(bytes);
    // TODO: Handle Message0. If it's a proof of user, disconnect
    //  right away if the proof is invalid.

    for (const peer of this.userStore) {
      const [pubkey, registry] = peer;
      await runSMPServer(socket, pubkey, this.timeout);
      // Just test the first one for now.
      break;
    }

    // for () {
    // TODO: message 1, indicate if this is the n'th message.
    // }
    // TODO: message 1, indicate it's the end.
    // TODO: start from the first peer.
  }

  onIncomingConnection(socket: WebSocket, request: http.IncomingMessage) {
    // Delegate to the corresponding handler
    socket.onmessage = async event => {
      const tlv = TLV.deserialize(event.data as Buffer);
      const tlvType = bigIntToNumber(tlv.type.value);

      const remoteAddress = request.connection.remoteAddress;
      if (remoteAddress !== undefined) {
        console.info(
          `server: incoming connection from ${remoteAddress}, type=${tlvType}`
        );
      } else {
        console.info(
          `server: incoming connection from unknown address, type=${tlvType}`
        );
      }
      switch (tlvType) {
        case requestType.JoinReq:
          this.onJoinRequest(socket, tlv.value);
          socket.close();
          break;
        case requestType.SearchReq:
          await this.onSearchRequest(socket, tlv.value);
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

export const sendSearchReq = async (
  ip: string,
  port: number,
  target: PubKey,
  timeout: number = TIMEOUT
): Promise<boolean> => {
  const c = new WebSocket(`${WS_PROTOCOL}://${ip}:${port}`);

  // Wait until the socket is opened.
  await waitForSocketOpen(c);

  const msg0 = new SearchMessage0();
  const req = new TLV(new Short(requestType.SearchReq), msg0.serialize());
  c.send(req.serialize());

  let isMatched = false;

  while (1) {
    try {
      isMatched = isMatched || (await runSMPClient(c, target, timeout));
    } catch (e) {
      if (e instanceof SearchFinished) {
        break;
      } else {
        throw e;
      }
    }
    // NOTE: Break whatever, for test.
    break;
  }
  return isMatched;
};
