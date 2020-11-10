import BN from "bn.js";
import { sha256 } from "js-sha256";
import { hash5, PrivKey, PubKey, sign, Signature, SNARK_FIELD_SIZE, verifySignature } from "maci-crypto";

import { PREFIX_JOIN, PREFIX_REGISTER_NEW_HUB } from "./constants";
import { bigIntMod } from "./smp/utils";


const hashStringToField = (s: string): BigInt => {
    return bigIntMod(BigInt(new BN(sha256(s), "hex").toString()), SNARK_FIELD_SIZE);
}

const prefixJoinMsg = hashStringToField(PREFIX_JOIN);
const prefixRegisterNewHub = hashStringToField(PREFIX_REGISTER_NEW_HUB);

const signMsg = (privkey: PrivKey, hashedData: BigInt): Signature => {
    return sign(privkey, hashedData);
}

const verifySignedMsg = (hashedData: BigInt, sig: Signature, pubkey: PubKey): boolean => {
    return verifySignature(
        hashedData,
        sig,
        pubkey,
    );
}

const getJoinHubMsgHashedData = (userPubkey: PubKey, hubPubkey: PubKey): BigInt => {
    return hash5([
        prefixJoinMsg,
        userPubkey[0],
        userPubkey[1],
        hubPubkey[0],
        hubPubkey[1],
    ])
}

const getCounterSignHashedData = (sigToBeCounterSigned: Signature): BigInt => {
    return hash5([
        sigToBeCounterSigned.R8[0],
        sigToBeCounterSigned.R8[1],
        BigInt(0),
        BigInt(0),
        BigInt(0),
    ]);
}

export {
    signMsg,
    verifySignedMsg,
    getJoinHubMsgHashedData,
    getCounterSignHashedData,
};
