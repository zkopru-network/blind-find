import { Command } from "commander";
import { genKeypair } from "maci-crypto";
import { IConfig } from "./configs";
import { keypairToCLIFormat } from "./utils";

export const buildCommandGeneral = (config: IConfig) => {
  const general = new Command("general");
  general
    .command("genKeypair")
    .description("generate a BlindFind keypair")
    .action(() => {
      const keypair = genKeypair();
      console.log(keypairToCLIFormat(keypair));
    });
  return general;
};
