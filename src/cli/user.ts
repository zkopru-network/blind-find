import { Command } from "commander";
import { PubKey, SNARK_FIELD_SIZE } from "maci-crypto";

import * as defaults from "./defaults";
import { LevelDB } from "../db";
import { ValueError } from "../exceptions";
import { User } from "../user";
import { IConfig } from "./configs";
import { getBlindFindContract } from "./contract";
import { base64ToObj, privkeyToKeipairCLI, privkeyToKeypair } from "./utils";

export const buildCommandUser = (configs: IConfig) => {
  const command = new Command("user");
  command
    .addCommand(buildCommandJoin(configs))
    .addCommand(buildCommandSearch(configs))
    .addCommand(buildCommandGetKeypair(configs));
  return command;
};

const buildCommandJoin = (configs: IConfig) => {
  const command = new Command("join");
  command
    .arguments("<hostname> <port> <hubPubkey>")
    .description("join a hub", {
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
        } = await loadUserSettings(configs);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        await user.join(hostname, port, hubPubkey);
      }
    );
  return command;
};

const buildCommandSearch = (configs: IConfig) => {
  const command = new Command("search");
  command
    .arguments("<hostname> <port> <targetPubkey>")
    .description("search for a user through a hub", {
      hostname: "hub's hostname",
      port: "hub's port",
      targetPubkey: "target user's public key in base64"
    })
    .action(
      async (hostname: string, portString: string, targetPubkeyB64: string) => {
        const port = Number(portString);
        const targetPubkey = base64ToObj(targetPubkeyB64) as PubKey;
        validatePubkey(targetPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(configs);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        const result = await user.search(hostname, port, targetPubkey);
        if (result === null) {
          console.log(`Failed to search for user ${targetPubkeyB64}`);
        } else {
          console.log(`Found user ${targetPubkeyB64}, proof = `, result);
        }
      }
    );
  return command;
};

const buildCommandGetKeypair = (configs: IConfig) => {
  const command = new Command("getKeypair");
  command.description("get user's keypair").action(async () => {
    console.log(privkeyToKeipairCLI(configs.blindFindPrivkey));
  });
  return command;
};

const loadUserSettings = async (configs: IConfig) => {
  const networkConfig = configs.network;
  const blindFindContract = getBlindFindContract(networkConfig);
  const adminAddress = await blindFindContract.getAdmin();
  const userKeypair = privkeyToKeypair(configs.blindFindPrivkey);
  const db = getDB();
  return {
    blindFindContract,
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
  return new LevelDB(defaults.dbDir);
};
