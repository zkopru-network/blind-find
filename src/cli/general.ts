import { Command } from "commander";
import { genKeypair, stringifyBigInts } from "maci-crypto";
import { IConfig } from "./configs";
import { objToBase64 } from "./utils";

export const buildCommandGeneral = (configs: IConfig) => {
  const general = new Command("general");
  general
    .command("genKeypair")
    .description("generate a BlindFind keypair")
    .action(() => {
      const keypair = genKeypair();
      console.log({
        privKey: stringifyBigInts(keypair.privKey),
        pubKey: stringifyBigInts(keypair.pubKey),
        pubKeyInBase64: objToBase64(keypair.pubKey)
      });
    });
  return general;
};
