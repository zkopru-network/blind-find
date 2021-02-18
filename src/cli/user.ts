import { Command } from "commander";
import { PubKey, SNARK_FIELD_SIZE, stringifyBigInts } from "maci-crypto";
import { parseProofOfSMPPublicSignals, TProof, TProofIndirectConnection } from "../circuits";
import { ValueError } from "../exceptions";
import { User } from "../user";
import { bigIntToEthAddress, ethAddressToBigInt } from "../web3";
import { IConfig } from "./configs";
import { base64ToObj, printObj, keypairToCLIFormat, objToBase64, pubkeyToCLIFormat, pubkeyFromCLIFormat } from "./utils";

export const buildCommandUser = (config: IConfig) => {
  const command = new Command("user");
  command
    .description("user join hubs and search for others")
    .addCommand(buildCommandJoin(config))
    .addCommand(buildCommandSearch(config))
    .addCommand(buildCommandGetKeypair(config))
    .addCommand(buildCommandVerifyProofIndirectConnection(config));
  return command;
};

const buildCommandJoin = (config: IConfig) => {
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
        const hubPubkey = pubkeyFromCLIFormat(hubPubkeyB64);
        validatePubkey(hubPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        await user.join(hostname, port, hubPubkey);
      }
    );
  return command;
};

const buildCommandSearch = (config: IConfig) => {
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
        const targetPubkey = pubkeyFromCLIFormat(targetPubkeyB64);
        validatePubkey(targetPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        const result = await user.search(hostname, port, targetPubkey);
        if (result === null) {
          console.log(`Not Found: target = '${targetPubkeyB64}'`);
          process.exit(1);
        } else {
          console.log(
            JSON.stringify(
              proofIndirectConnectionToCLIFormat(result),
              null,
              "\t",
            )
          );
        }
      }
    );
  return command;
};

const buildCommandGetKeypair = (config: IConfig) => {
  const command = new Command("getKeypair");
  command.description("get user's keypair").action(async () => {
    printObj(keypairToCLIFormat(config.getKeypair()));
  });
  return command;
};

const buildCommandVerifyProofIndirectConnection = (config: IConfig) => {
  const command = new Command("verifyProof");
  command
    .arguments("<proofBase64Encoded>")
    .description("verify a Proof Of Indirect Connection", {
      proofBase64Encoded: "a proof of indirect connection encoded in base64",
    })
    .action(
      async (proofBase64Encoded: string) => {
        const proof = parseProofIndirectConnectionBase64Encoded(proofBase64Encoded);
        const formatted = proofIndirectConnectionToCLIFormat(proof);
        const proofInfo = {
          pubkeySearcher: formatted.pubkeySearcher,
          pubkeyTarget: formatted.pubkeyTarget,
          adminAddress: formatted.adminAddress,
          merkleRoot: formatted.merkleRoot,
        }
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        if (!await user.verifyProofOfIndirectConnection(proof)) {
          console.log("Invalid proof!");
          console.log(proofInfo);
          process.exit(1);
        } else {
          console.log("Proof is correct!");
          console.log(proofInfo);
          process.exit(0);
        }
      }
    );
  return command;
};

const loadUserSettings = async (config: IConfig) => {
  const blindFindContract = config.getBlindFindContract();
  const adminAddress = await blindFindContract.getAdmin();
  const userKeypair = config.getKeypair();
  const db = config.getDB();
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

const stringifyProof = (proof: TProof) => {
  return {
    proof: stringifyBigInts(proof.proof),
    publicSignals: stringifyBigInts(proof.publicSignals),
  }
}

export const proofIndirectConnectionToCLIFormat = (proof: TProofIndirectConnection) => {
  const root = parseProofOfSMPPublicSignals(proof.proofOfSMP.publicSignals).merkleRoot;
  const proofEncoded = {
    pubkeySearcher: pubkeyToCLIFormat(proof.pubkeyA),
    pubkeyTarget: pubkeyToCLIFormat(proof.pubkeyC),
    adminAddress: bigIntToEthAddress(proof.adminAddress),
    merkleRoot: stringifyBigInts(root) as string,
    proofOfSMP: stringifyProof(proof.proofOfSMP),
    proofSuccessfulSMP: stringifyProof(proof.proofSuccessfulSMP),
  }
  return {
    pubkeySearcher: proofEncoded.pubkeySearcher,
    pubkeyTarget: proofEncoded.pubkeyTarget,
    adminAddress: proofEncoded.adminAddress,
    merkleRoot: proofEncoded.merkleRoot,
    base64Encoded: objToBase64(proofEncoded),
  }
}

export const parseProofIndirectConnectionBase64Encoded = (base64Encoded: string): TProofIndirectConnection => {
  const proofIndirectConnection = base64ToObj(base64Encoded);
  return {
    pubkeyA: pubkeyFromCLIFormat(proofIndirectConnection.pubkeySearcher),
    pubkeyC: pubkeyFromCLIFormat(proofIndirectConnection.pubkeyTarget),
    adminAddress: ethAddressToBigInt(proofIndirectConnection.adminAddress),
    proofOfSMP: proofIndirectConnection.proofOfSMP,
    proofSuccessfulSMP: proofIndirectConnection.proofSuccessfulSMP,
  }
}
