import { Command } from "commander";
import { PubKey, SNARK_FIELD_SIZE } from "maci-crypto";

import * as defaults from "./defaults";
import { LevelDB } from "../db";
import { ValueError } from "../exceptions";
import { User } from "../user";
import { loadConfigs, parseUserConfig } from "./configs";
import { getBlindFindContract } from "./provider";
import { base64ToObj, privkeyToKeypair } from "./utils";

export const buildCommandUser = () => {
  const command = new Command("user");
  command.addCommand(buildCommandJoin()).addCommand(buildCommandSearch());
  return command;
};

const buildCommandJoin = () => {
  const command = new Command("join");
  command
    .arguments("<hostname> <port> <hubPubkey>")
    .description("Join a hub", {
      hostname: "hub's hostname",
      port: "hub's port",
      hubPubkey: "hub's public key in base64"
    })
    .action(
      async (hostname: string, portString: string, hubPubkeyB64: string) => {
        const port = Number(portString);
        const hubPubkey = base64ToObj(hubPubkeyB64) as PubKey;
        validatePubkey(hubPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings();
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        await user.join(hostname, port, hubPubkey);
      }
    );
  return command;
};

const buildCommandSearch = () => {
  const command = new Command("search");
  return command;
};

const loadUserSettings = async () => {
  const configs = await loadConfigs();
  const networkConfig = configs.network;
  const userConfig = parseUserConfig(configs);
  const blindFindContract = getBlindFindContract(networkConfig);
  const adminAddress = await blindFindContract.getAdmin();
  const userKeypair = privkeyToKeypair(userConfig.blindFindPrivkey);
  const db = getDB();
  return {
    blindFindContract,
    userConfig,
    adminAddress,
    userKeypair,
    db
  };
};

const validatePubkey = (pubkey: PubKey) => {
  if (
    pubkey.length !== 2 ||
    typeof pubkey[0] !== "bigint" ||
    typeof pubkey[1] !== "bigint" ||
    pubkey[0] < BigInt(0) ||
    pubkey[0] >= SNARK_FIELD_SIZE ||
    pubkey[1] < BigInt(0) ||
    pubkey[1] >= SNARK_FIELD_SIZE
  ) {
    throw new ValueError(`invalid pubkey: ${pubkey}`);
  }
};

const getDB = () => {
  return new LevelDB(defaults.dbUser);
};
