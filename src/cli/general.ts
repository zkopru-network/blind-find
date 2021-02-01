import { Command } from "commander";
import { genKeypair } from "maci-crypto";
import { IConfig } from "./configs";
import { printObj, keypairToCLIFormat } from "./utils";

export const buildCommandGeneral = (config: IConfig) => {
  const general = new Command("general");
  general.description("utility functions");
  general
    .command("genKeypair")
    .description("generate a BlindFind keypair")
    .action(() => {
      const keypair = genKeypair();
      printObj(keypairToCLIFormat(keypair));
    });
  return general;
};
