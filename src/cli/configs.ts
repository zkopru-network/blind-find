import * as fs from "fs";
import {
  genPrivKey,
  Keypair,
  PrivKey,
  stringifyBigInts,
  unstringifyBigInts
} from "maci-crypto";
import * as path from "path";
import YAML from "yaml";
import { TRateLimitParams } from "../websocket";

import * as defaults from "./defaults";
import { configsFileName, dbDir } from "./constants";
import {
  NoUserConfigs,
  IncompleteConfig,
  UnsupportedNetwork
} from "./exceptions";
import { IAtomicDB } from "../interfaces";
import { BlindFindContract } from "../web3";
import { ethers, Wallet } from "ethers";
import { LevelDB } from "../db";
import { privkeyToKeypair } from "./utils";

interface IAdminConfig {
  adminEthereumPrivkey?: string;
  rateLimit: {
    global: TRateLimitParams;
  };
}

interface IHubConfig {
  rateLimit: {
    join: TRateLimitParams;
    search: TRateLimitParams;
    global: TRateLimitParams;
  };
}

interface IWeb3Params {
  name: "web3";
  ip: string;
  port: string;
}

interface IInfuraParams {
  name: "infura";
  apiKey: string;
}

export interface INetworkConfig {
  network: string;
  provider: IWeb3Params | IInfuraParams;
}

export interface IOptions {
  network: INetworkConfig;
  blindFindPrivkey: PrivKey;
  admin?: IAdminConfig;
  hub?: IHubConfig;
}

export interface IConfig {
  getAdminConfig(): IAdminConfig;
  getHubConfig(): IHubConfig;
  getDB(): IAtomicDB;
  getBlindFindContract(): BlindFindContract;
  getKeypair(): Keypair;
}

/*
  Read user's option from disk, parse it, and load it with defaults.
*/
export class BlindFindConfig {
  constructor(
    private readonly userOptions: IOptions,
    private readonly dataDir: string
  ) {
    this.validateUserOptions(userOptions);
  }

  private validateUserOptions(userOptions: IOptions): void {
    if (userOptions.blindFindPrivkey === undefined) {
      throw new IncompleteConfig("blind find privkey is not found");
    }
    if (typeof userOptions.blindFindPrivkey !== "bigint") {
      throw new IncompleteConfig("blind find privkey is in a wrong type");
    }
    const network = userOptions.network;
    if (network === undefined) {
      throw new IncompleteConfig("network is not specified");
    }
    if (network.network === undefined) {
      throw new IncompleteConfig("network.network is not specified");
    }
    if (typeof network.network !== "string") {
      throw new IncompleteConfig("network.network should be a string");
    }
    const provider = network.provider;
    if (provider === undefined) {
      throw new IncompleteConfig("provider is not specified");
    }
    if (provider.name === undefined) {
      throw new IncompleteConfig("provider.name is not specified");
    } else if (provider.name === "infura") {
      if (provider.apiKey === undefined) {
        throw new IncompleteConfig("provider.apiKey is not specified");
      }
      if (typeof provider.apiKey !== "string") {
        throw new IncompleteConfig("provider.apiKey should be a string");
      }
      // TODO: Support JSONRPC
    } else {
      throw new UnsupportedNetwork(`${provider.name} is not supported yet`);
    }
  }

  public getAdminConfig(): IAdminConfig {
    const admin = this.userOptions.admin;
    if (admin === undefined) {
      throw new IncompleteConfig("admin is not specified");
    }
    if (admin.adminEthereumPrivkey === undefined) {
      throw new IncompleteConfig("admin.adminEthereumPrivkey is not specified");
    }
    if (typeof admin.adminEthereumPrivkey !== "string") {
      throw new IncompleteConfig(
        "admin.adminEthereumPrivkey should be a string"
      );
    }
    return admin;
  }

  public getHubConfig(): IHubConfig {
    const hub = this.userOptions.hub;
    if (hub === undefined) {
      return {
        rateLimit: defaults.defaultHubRateLimit
      };
    }
    if (hub.rateLimit === undefined) {
      hub.rateLimit = defaults.defaultHubRateLimit;
    } else {
      if (hub.rateLimit.join === undefined) {
        hub.rateLimit.join = defaults.defaultHubRateLimit.join;
      }
      if (hub.rateLimit.search === undefined) {
        hub.rateLimit.search = defaults.defaultHubRateLimit.search;
      }
      if (hub.rateLimit.global === undefined) {
        hub.rateLimit.global = defaults.defaultHubRateLimit.global;
      }
    }
    return hub;
  }

  getDB(): IAtomicDB {
    const dbPath = path.join(this.dataDir, dbDir);
    return new LevelDB(dbPath);
  }

  getBlindFindContract(): BlindFindContract {
    const networkConfig = this.userOptions.network;
    const providerConfig = networkConfig.provider;
    if (providerConfig.name === "infura") {
      const provider = new ethers.providers.InfuraProvider(
        networkConfig.network,
        providerConfig.apiKey
      );
      const abi = contractInfo.abi;
      const contractDetail = contractInfo.networks[networkConfig.network];
      let providerOrWallet: Wallet | ethers.providers.BaseProvider = provider;
      const adminConfig = this.getAdminConfig();
      const privkey = adminConfig.adminEthereumPrivkey;
      if (privkey !== undefined) {
        providerOrWallet = new ethers.Wallet(privkey, provider);
      }
      const c = new ethers.Contract(
        contractDetail.address,
        abi,
        providerOrWallet
      );
      return new BlindFindContract(c, contractDetail.atBlock);
    } else {
      throw new UnsupportedNetwork(
        `provider ${providerConfig.name} is not supported yet`
      );
    }
  }

  getKeypair(): Keypair {
    return privkeyToKeypair(this.userOptions.blindFindPrivkey);
  }

  static async loadFromDataDir(dataDir?: string): Promise<BlindFindConfig> {
    if (dataDir === undefined) {
      dataDir = defaults.dataDir;
    }
    const configsPath = path.join(dataDir, configsFileName);
    try {
      const configString = await fs.promises.readFile(configsPath, "utf-8");
      const userOptions = unstringifyBigInts(
        YAML.parse(configString)
      ) as IOptions;
      return new BlindFindConfig(userOptions, dataDir);
    } catch (e) {
      // If no `config.yaml` is found, provide a template.
      if (e.code === "ENOENT") {
        // mkdir -p `filePath`
        const dirName = path.dirname(configsPath);
        await fs.promises.mkdir(dirName, { recursive: true });
        // Write config template
        const templateYAML = YAML.stringify(
          stringifyBigInts(createConfigsYAMLTemplate())
        );
        await fs.promises.writeFile(configsPath, templateYAML, "utf-8");
        throw new NoUserConfigs(
          `${configsPath} is not found and thus a template is generated. ` +
            "Complete the template and try again."
        );
      } else {
        throw e;
      }
    }
  }
}

const createConfigsYAMLTemplate = () => {
  return {
    network: {
      network: defaults.network,
      provider: {
        name: "infura",
        apiKey: "Put your infura api key here"
      }
    },
    blindFindPrivkey: genPrivKey(),
    admin: {
      adminEthereumPrivkey: "private key of the Blind Find contract admin"
    }
  };
};

interface IContractAddress {
  [network: string]: { address: string; atBlock: number };
}
interface IContractInfo {
  abi: any;
  networks: IContractAddress;
}

const contractInfo: IContractInfo = {
  // NOTE: Or should abi be compiled from the source, to avoid being outdated when the contract is updated.
  abi: [
    { inputs: [], stateMutability: "nonpayable", type: "constructor" },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "merkleRoot",
          type: "uint256"
        }
      ],
      name: "UpdateMerkleRoot",
      type: "event"
    },
    {
      inputs: [],
      name: "admin",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "latestMerkleRoot",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ internalType: "uint256", name: "root", type: "uint256" }],
      name: "updateMerkleRoot",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    }
  ],
  networks: {
    kovan: {
      address: "0xE57881D655309C9a20f469a95564beaEb93Ce73A",
      atBlock: 23208018
    }
  }
};
