import {
  genPubKey,
  Keypair,
  PrivKey,
  stringifyBigInts,
  unstringifyBigInts
} from "maci-crypto";

export const objToBase64 = (obj: any): string => {
  const objWithBigIntStringified = stringifyBigInts(obj);
  const objInString = JSON.stringify(objWithBigIntStringified);
  // Parsed with utf-8 encoding
  const objInBuffer = Buffer.from(objInString, "utf-8");
  // To base64
  return objInBuffer.toString("base64");
};

export const base64ToObj = (b64string: string): any => {
  // Parse base64 string to buffer
  const objInBuffer = Buffer.from(b64string, "base64");
  // Decode the buffer with ubf-8
  const objInString = objInBuffer.toString("utf-8");
  const objWithBigIntStringified = JSON.parse(objInString);
  return unstringifyBigInts(objWithBigIntStringified);
};

export const privkeyToKeypair = (privkey: PrivKey): Keypair => {
  return {
    privKey: privkey,
    pubKey: genPubKey(privkey)
  };
};

export const privkeyToKeipairCLI = (privkey: PrivKey) => {
  const keypair = privkeyToKeypair(privkey);
  return {
    privKey: stringifyBigInts(keypair.privKey),
    pubKey: stringifyBigInts(keypair.pubKey),
    pubKeyInBase64: objToBase64(keypair.pubKey)
  };
};
