import { Command } from "commander";
import { HubServer, THubRegistryWithProof } from "../hub";
import { LevelDB } from "../db";
import { loadConfigs, parseHubConfig } from "./configs";
import { dbDir } from "./defaults";
import { getBlindFindContract } from "./provider";
import { base64ToObj, objToBase64, privkeyToKeypair } from "./utils";
import { hubRegistryToObj, objToHubRegistry } from "../dataProvider";
import { hashLeftRight, IncrementalQuinTree } from "maci-crypto";
import { HubRegistry } from "..";
import { ValueError } from "../exceptions";
import { MerkleProof } from "../interfaces";
import { BlindFindContract } from "../web3";

export const buildCommandHub = () => {
  const command = new Command("hub");
  command
    .addCommand(buildCommandCreateHubRegistry())
    .addCommand(buildCommandSetHubRegistryWithProof())
    .addCommand(buildCommandStart());
  return command;
};

const buildCommandCreateHubRegistry = () => {
  const command = new Command("createHubRegistry");
  command
    .description(
      "Create a hub registry. To be registered as a valid hub, " +
        "this registry must be set to admin and added to hub registry tree."
    )
    .action(async () => {
      const { adminAddress, hubKeypair } = await loadHubSettings();

      const hubRegistry = HubRegistry.fromKeypair(hubKeypair, adminAddress);
      console.log(objToBase64(hubRegistryToObj(hubRegistry)));
    });
  return command;
};

const buildCommandSetHubRegistryWithProof = () => {
  const command = new Command("setHubRegistryWithProof");
  command
    .arguments("<hubRegistryWithProof>")
    .description(
      "Set hub registry along with its merkle proof to the database",
      {
        hubRegistryWithProof:
          "a `HubRegistryWithProof` object encoded in base64"
      }
    )
    .action(async (hubRegistryWithProofB64: string) => {
      const { blindFindContract, adminAddress } = await loadHubSettings();
      const hubRegistryWithProofObj = base64ToObj(
        hubRegistryWithProofB64
      ) as THubRegistryWithProof;
      if (
        hubRegistryWithProofObj.hubRegistry === undefined ||
        hubRegistryWithProofObj.merkleProof === undefined
      ) {
        throw new ValueError(
          `hubRegistryWithProofObj does not have valid properties: hubRegistryWithProofObj=${hubRegistryWithProofObj}`
        );
      }
      const hubRegistry = objToHubRegistry(hubRegistryWithProofObj.hubRegistry);
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
      const merkleProof = hubRegistryWithProofObj.merkleProof;
      validateMerkleProof(hubRegistry, merkleProof);
      await validateMerkleRoot(blindFindContract, merkleProof.root);

      // Store this valid hub registry and its proof.
      const levelDB = new LevelDB(dbDir);
      await HubServer.setHubRegistryToDB(levelDB, {
        hubRegistry: hubRegistryToObj(hubRegistry),
        merkleProof: merkleProof
      });
    });
  return command;
};

const buildCommandStart = () => {
  const command = new Command("start");
  command
    .arguments("[port] [hostname]")
    .description("Start the hub server", {
      port: "port hub server listens to",
      hostname: "interface hub server listens to, default to be 0.0.0.0"
    })
    .action(
      async (portString: string | undefined, hostname: string | undefined) => {
        const { adminAddress, hubKeypair, hubConfig } = await loadHubSettings();
        const levelDB = new LevelDB(dbDir);
        const hubServer = new HubServer(
          hubKeypair,
          adminAddress,
          hubConfig.rateLimit,
          levelDB
        );
        const port: number | undefined =
          portString === undefined ? undefined : Number(portString);
        await hubServer.start(port, hostname);
        console.log("Press Ctrl-C to exit");
        await hubServer.waitClosed();
      }
    );
  return command;
};

const loadHubSettings = async () => {
  const configs = await loadConfigs();
  const networkConfig = configs.network;
  const hubConfig = parseHubConfig(configs);
  const blindFindContract = getBlindFindContract(networkConfig);
  const adminAddress = await blindFindContract.getAdmin();
  const hubKeypair = privkeyToKeypair(hubConfig.blindFindPrivkey);
  return {
    blindFindContract,
    hubConfig,
    adminAddress,
    hubKeypair
  };
};

const validateMerkleProof = (
  hubRegistry: HubRegistry,
  merkleProof: MerkleProof
) => {
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
};

const validateMerkleRoot = async (
  contract: BlindFindContract,
  merkleRoot: BigInt
) => {
  const allRoots = await contract.getAllMerkleRoots();
  if (!allRoots.has(merkleRoot)) {
    throw new ValueError("merkle root is not on chain");
  }
};
