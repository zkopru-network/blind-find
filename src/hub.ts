import * as http from "http";
import { Keypair, PubKey, Signature } from "maci-crypto";
import WebSocket from "ws";

import { getCounterSignHashedData, signMsg, verifySignedMsg } from ".";
import { RequestFailed } from "./exceptions";
import {
  JoinReq,
  JoinResp,
  SearchMessage0,
  SearchMessage1,
  SearchMessage2,
  SearchMessage3,
  SearchMessage4,
  msgType
} from "./serialization";
import { TLV, Short } from "./smp/serialization";
import { bigIntToNumber } from "./smp/utils";
import { BaseServer, request, waitForSocketOpen, connect } from "./websocket";
import { TIMEOUT, MAXIMUM_TRIALS } from "./configs";
import { SMPStateMachine } from "./smp";
import { hashPointToScalar } from "./utils";

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
  await request(
    socket,
    msg3.serialize(),
    data => SearchMessage4.deserialize(data),
    timeout
  );
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
    // TODO: Handle Message0. If it's a proof of user, disconnect
    //  right away if the proof is invalid.
    SearchMessage0.deserialize(bytes);

    for (const peer of this.userStore) {
      const [pubkey] = peer;
      console.debug(`runSMPServer: running smp using ${pubkey}`);
      const secret = hashPointToScalar(pubkey);
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
        this.timeout
      );
      console.debug(`runSMPServer: received msg2`);
      const smpMsg3 = stateMachine.transit(msg2);
      if (smpMsg3 === null) {
        throw new Error("this should never happen");
      }
      const msg3 = new SearchMessage3(smpMsg3, {
        proof: "123",
        publicSignals: "456"
      });
      console.debug(`runSMPServer: sending msg3`);
      await request(
        socket,
        msg3.serialize(),
        data => SearchMessage4.deserialize(data),
        this.timeout
      );
    }
    const endMessage1 = new SearchMessage1(true);
    socket.send(endMessage1.serialize());
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
        case msgType.JoinReq:
          this.onJoinRequest(socket, tlv.value);
          socket.close();
          break;
        case msgType.SearchReq:
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
  const c = connect(ip, port);

  // Wait until the socket is opened.
  await waitForSocketOpen(c);
  const joinReq = new JoinReq(userPubkey, userSig);
  const req = new TLV(new Short(msgType.JoinReq), joinReq.serialize());

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
  timeout: number = TIMEOUT,
  maximumTrial: number = MAXIMUM_TRIALS
): Promise<boolean> => {
  const c = connect(ip, port);

  // Wait until the socket is opened.
  await waitForSocketOpen(c);

  const msg0 = new SearchMessage0();
  const req = new TLV(new Short(msgType.SearchReq), msg0.serialize());
  c.send(req.serialize());

  let isMatched = false;
  // TODO: Where should it be checked?
  let numTrials = 0;

  const secret = hashPointToScalar(target);

  while (numTrials < maximumTrial) {
    console.debug(`runSMPClient: starting trial ${numTrials}`);
    const stateMachine = new SMPStateMachine(secret);
    const msg1 = await request(
      c,
      undefined,
      data => SearchMessage1.deserialize(data),
      timeout
    );
    console.debug(`runSMPClient: received msg1`);
    // Check if there is no more candidates.
    // TODO: Add a check for maximum candidates, to avoid endless searching with the server.
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
    console.debug(`runSMPClient: sending msg2`);
    const msg3 = await request(
      c,
      msg2.serialize(),
      data => SearchMessage3.deserialize(data),
      timeout
    );
    const msg4 = new SearchMessage4();
    c.send(msg4.serialize());
    console.debug(`runSMPClient: received msg3`);
    stateMachine.transit(msg3.smpMsg3);
    if (!stateMachine.isFinished()) {
      throw new RequestFailed(
        "smp should have been finished. there must be something wrong"
      );
    }
    isMatched = isMatched || stateMachine.getResult();
    numTrials++;
  }
  c.close();
  return isMatched;
};
