import { Command } from "commander";
import { HubServer, THubRegistryWithProof } from "../hub";
import { IConfig } from "./configs";
import {
  base64ToObj,
  objToBase64,
  keypairToCLIFormat,
  printObj, pubkeyFromCLIFormat, pubkeyToCLIFormat
} from "./utils";
import { hashLeftRight, IncrementalQuinTree } from "maci-crypto";
import { HubRegistry } from "..";
import { ValueError } from "../exceptions";
import { MerkleProof } from "../interfaces";
import { BlindFindContract } from "../web3";

export const buildCommandHub = (config: IConfig) => {
  const command = new Command("hub");
  command
    .description("hub lets users join and replies to search requests")
    .addCommand(buildCommandCreateHubRegistry(config))
    .addCommand(buildCommandSetHubRegistryWithProof(config))
    .addCommand(buildCommandStart(config))
    .addCommand(buildCommandGetKeypair(config))
    .addCommand(buildCommandGetJoinedUsers(config))
    .addCommand(buildCommandRemoveUser(config))
    .addCommand(buildCommandRemoveAllUsers(config));
  return command;
};

const buildCommandCreateHubRegistry = (config: IConfig) => {
  const command = new Command("createHubRegistry");
  command
    .description(
      "create a hub registry. To be registered as a valid hub, " +
        "this registry must be set to admin and added to hub registry tree."
    )
    .action(async () => {
      const { adminAddress, hubKeypair } = await loadHubSettings(config);

      const hubRegistry = HubRegistry.fromKeypair(hubKeypair, adminAddress);
      const obj = hubRegistry.toObj();
      printObj({
        sig: obj.sig,
        pubkey: obj.pubkey,
        adminAddress: obj.adminAddress,
        base64Encoded: objToBase64(obj),
      });
    });
  return command;
};

const buildCommandSetHubRegistryWithProof = (config: IConfig) => {
  const command = new Command("setHubRegistryWithProof");
  command
    .arguments("<hubRegistryWithProof>")
    .description(
      "set hub registry along with its merkle proof to the database",
      {
        hubRegistryWithProof:
          "a `HubRegistryWithProof` object encoded in base64"
      }
    )
    .action(async (hubRegistryWithProofB64: string) => {
      const { blindFindContract, adminAddress } = await loadHubSettings(config);
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
      const hubRegistryObj = hubRegistryWithProofObj.hubRegistry;
      const hubRegistry = new HubRegistry(hubRegistryObj);
      // Verify hubRegistry
      if (hubRegistryObj.adminAddress !== adminAddress) {
        throw new ValueError(
          `adminAddresses mismatch: hubRegistry.adminAddress=${hubRegistryObj.adminAddress}, ` +
            `adminAddress=${adminAddress}`
        );
      }
      if (!hubRegistry.verify()) {
        throw new ValueError("hubRegistry has an invalid signature");
      }
      // Verify hub registry tree merkleProof
      const merkleProof = hubRegistryWithProofObj.merkleProof;
      validateMerkleProof(hubRegistry, merkleProof);
      await validateMerkleRoot(blindFindContract, merkleProof.root);

      // FIXME: Should have more checks here
      // Store this valid hub registry and its proof.
      const db = config.getDB();
      await HubServer.setHubRegistryToDB(db, {
        hubRegistry: hubRegistryObj,
        merkleProof: merkleProof
      });
    });
  return command;
};

const buildCommandStart = (config: IConfig) => {
  const command = new Command("start");
  command
    .arguments("[port] [hostname]")
    .description("start the hub server", {
      port: "port hub server listens to",
      hostname: "interface hub server listens to, default to be 0.0.0.0"
    })
    .action(
      async (portString: string | undefined, hostname: string | undefined) => {
        const { hubServer } = await getHub(config);
        const port: number | undefined =
          portString === undefined ? undefined : Number(portString);
        await hubServer.start(port, hostname);
        const hubPubkeyB64 = pubkeyToCLIFormat(hubServer.keypair.pubKey);
        console.log(
          `Hub is listening on`,
          hubServer.address,
          `, with pubkey in base64 = '${hubPubkeyB64}'`
        );
        console.log("Press Ctrl-C to exit");
        await hubServer.waitClosed();
      }
    );
  return command;
};

const buildCommandGetKeypair = (config: IConfig) => {
  const command = new Command("getKeypair");
  command.description("get hub's keypair").action(async () => {
    printObj(keypairToCLIFormat(config.getKeypair()));
  });
  return command;
};

const buildCommandGetJoinedUsers = (config: IConfig) => {
  const command = new Command("getJoinedUsers");
  command
    .description("list the users who has have joined the hub")
    .action(async () => {
      const { hubServer } = await getHub(config);
      const userPubkeys: string[] = [];
      for await (const user of hubServer.userStore) {
        userPubkeys.push(pubkeyToCLIFormat(user[0]));
      }
      printObj(userPubkeys);
    });
  return command;
};

const buildCommandRemoveUser = (config: IConfig) => {
  const command = new Command("removeUser");
  command
    .arguments("[userPubkeyB64]")
    .description("remove a joined user", {
      userPubkeyB64: "user's public key in base64"
    })
    .action(async (userPubkeyB64: string) => {
      const userPubkey = pubkeyFromCLIFormat(userPubkeyB64);
      const { hubServer } = await getHub(config);
      await hubServer.removeUser(userPubkey);
    });
  return command;
};

const buildCommandRemoveAllUsers = (config: IConfig) => {
  const command = new Command("removeAllUsers");
  command
    .description("remove all joined users")
    .action(async () => {
      const { hubServer } = await getHub(config);
      await hubServer.removeAllUsers();
    });
  return command;
};

const loadHubSettings = async (config: IConfig) => {
  const hubConfig = config.getHubConfig();
  const blindFindContract = config.getBlindFindContract();
  const adminAddress = await blindFindContract.getAdmin();
  const hubKeypair = config.getKeypair();
  return {
    blindFindContract,
    hubConfig,
    adminAddress,
    hubKeypair
  };
};

const getHub = async (config: IConfig) => {
  const hubConfig = config.getHubConfig();
  const blindFindContract = config.getBlindFindContract();
  const adminAddress = await blindFindContract.getAdmin();
  const hubKeypair = config.getKeypair();
  const db = config.getDB();
  const hubServer = new HubServer(
    hubKeypair,
    adminAddress,
    hubConfig.rateLimit,
    db
  );
  return {
    hubServer,
    blindFindContract
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

// TODO: should have another function checking hub connection tree roots.
const validateMerkleRoot = async (
  contract: BlindFindContract,
  merkleRoot: BigInt
) => {
  const allRoots = await contract.getAllHubRegistryTreeRoots();
  if (!allRoots.has(merkleRoot)) {
    throw new ValueError("merkle root is not on chain");
  }
};
