import { Command } from "commander";
import { HubServer } from "../hub";
import { LevelDB } from "../db";
import { loadConfigs, parseHubConfig } from "./configs";
import { dbDir } from "./defaults";
import { getBlindFindContract } from "./provider";
import { base64ToObj, objToBase64 } from "./utils";
import { hubRegistryToObj, objToHubRegistry } from "../dataProvider";
import {
  genPubKey,
  hashLeftRight,
  IncrementalQuinTree,
  Keypair
} from "maci-crypto";
import { HubRegistry } from "..";
import { ValueError } from "../exceptions";
import { MerkleProof } from "../interfaces";

export const buildCommandHub = () => {
  const command = new Command("hub");
  command
    .addCommand(buildCreateHubRegistry())
    .addCommand(buildSetHubRegistry());
  return command;
};

const buildCreateHubRegistry = () => {
  const command = new Command("createHubRegistry");
  command.description("create a hub registry").action(async () => {
    const configs = await loadConfigs();
    const networkConfig = configs.network;
    const blindFindContract = getBlindFindContract(networkConfig);
    const adminAddress = await blindFindContract.getAdmin();

    const hubConfig = parseHubConfig(configs);
    const hubKeypair: Keypair = {
      privKey: hubConfig.blindFindPrivkey,
      pubKey: genPubKey(hubConfig.blindFindPrivkey)
    };

    const hubRegistry = HubRegistry.fromKeypair(hubKeypair, adminAddress);
    console.log(objToBase64(hubRegistryToObj(hubRegistry)));
  });
  return command;
};

const buildSetHubRegistry = () => {
  const command = new Command("setHubRegistry");
  command
    .arguments("<hubRegistry> <merkleProof>")
    .description("set hub registry to the database", {
      hubRegistry: "a HubRegistry object encoded in base64",
      merkleProof: "the corresponding merkle proof encoded in base64"
    })
    .action(async (hubRegistryB64: string, merkleProofB64: string) => {
      const configs = await loadConfigs();
      const networkConfig = configs.network;
      const blindFindContract = getBlindFindContract(networkConfig);
      const adminAddress = await blindFindContract.getAdmin();
      const hubRegistryObj = base64ToObj(hubRegistryB64);
      const hubRegistry = objToHubRegistry(hubRegistryObj);
      // Verify hubRegistry
      if (hubRegistry.adminAddress !== adminAddress) {
        throw new ValueError(
          `adminAddresses mismatch: hubRegistry.adminAddress=${hubRegistry.adminAddress}, ` +
            `adminAddress=${adminAddress}`
        );
      }
      if (!hubRegistry.verify()) {
        throw new ValueError("hubRegistry has an invalid signature");
      }

      // Verify merkleProof
      const merkleProof = base64ToObj(merkleProofB64) as MerkleProof;
      if (merkleProof.leaf !== hubRegistry.hash()) {
        throw new ValueError("merkleProof mismatches hubRegistry");
      }
      const hashFunc = (leaves: BigInt[]) => {
        if (leaves.length !== 2) {
          throw new Error(
            `we're using binary merkle tree but got more than 2 elements: ` +
              `length=${leaves.length}`
          );
        }
        return hashLeftRight(leaves[0], leaves[1]);
      };
      if (!IncrementalQuinTree.verifyMerklePath(merkleProof, hashFunc)) {
        throw new ValueError("merkleProof is invalid");
      }

      const levelDB = new LevelDB(dbDir);

      await HubServer.setHubRegistryWithProof(levelDB, {
        registry: hubRegistryToObj(hubRegistry),
        merkleProof: merkleProof
      });
    });

  return command;
};

// const getHub = async () => {
//   const configs = await loadConfigs();
//   const networkConfig = configs.network;
//   const hubConfig = parseHubConfig(configs);
//   const hubKeypair: Keypair = {
//       privKey: hubConfig.blindFindPrivkey,
//       pubKey: genPubKey(hubConfig.blindFindPrivkey),
//   };
//   const blindFindContract = getBlindFindContract(networkConfig);
//   const levelDB = new LevelDB(dbDir);
//   await HubServer.setHubRegistryWithProof();
//   const hub = new HubServer(hubKeypair, );
// };
