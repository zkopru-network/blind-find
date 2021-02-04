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
import { ConfigError } from "./exceptions";
import { IAtomicDB } from "../interfaces";
import { BlindFindContract } from "../web3";
import { ethers, Wallet } from "ethers";
import { LevelDB } from "../db";
import { privkeyToKeypair } from "./utils";
import { abi, contractAddressInNetwork } from "./contractInfo";

interface IContractAddress {
  address: string;
  atBlock: number;
}

interface IAdminConfig {
  adminEthereumPrivkey: string;
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
  url: string;
  // - if `customContractAddress` is specified, try `customContractAddress`.
  // - else, use `contractInfo[network]` if `network` is specified.
  network?: string;
  customContractAddress?: IContractAddress;
}

interface IInfuraParams {
  name: "infura";
  apiKey: string;
  // - if `customContractAddress` is specified, try `customContractAddress`.
  // - else, use the `contractInfo[network]`.
  network: string;
  customContractAddress?: IContractAddress;
}

interface INetworkOptions {
  provider: IWeb3Params | IInfuraParams;
}

export interface IOptions {
  network: INetworkOptions;
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

export class BlindFindConfig {
  constructor(
    private readonly userOptions: IOptions,
    private readonly dataDir: string
  ) {
    this.validateUserOptions(userOptions);
  }

  private validateUserOptions(userOptions: IOptions): void {
    if (userOptions.blindFindPrivkey === undefined) {
      throw new ConfigError("blind find privkey is not found");
    }
    if (typeof userOptions.blindFindPrivkey !== "bigint") {
      throw new ConfigError("blind find privkey is in a wrong type");
    }
    const network = userOptions.network;
    if (network === undefined) {
      throw new ConfigError("network is not specified");
    }
    const provider = network.provider;
    if (provider === undefined) {
      throw new ConfigError("provider is not specified");
    }
    if (provider.name === undefined) {
      throw new ConfigError("provider.name is not specified");
    } else if (provider.name === "infura") {
      if (provider.apiKey === undefined) {
        throw new ConfigError("provider.apiKey is not specified");
      }
      if (typeof provider.apiKey !== "string") {
        throw new ConfigError("provider.apiKey should be a string");
      }
      if (provider.network === undefined) {
        throw new ConfigError("provider.network must be specified when using infura");
      }
    } else if (provider.name === 'web3') {
      if (provider.url === undefined) {
        throw new ConfigError("provider.url is not specified");
      }
      if (typeof provider.url !== "string") {
        throw new ConfigError("provider.url should be a string");
      }
    } else {
      throw new ConfigError(`network is not supported`);
    }
  }

  public getAdminConfig(): IAdminConfig {
    const admin = this.userOptions.admin;
    if (admin === undefined) {
      throw new ConfigError("admin is not specified");
    }
    if (admin.adminEthereumPrivkey === undefined) {
      throw new ConfigError("admin.adminEthereumPrivkey is not specified");
    }
    if (typeof admin.adminEthereumPrivkey !== "string") {
      throw new ConfigError(
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
    let provider: ethers.providers.BaseProvider;
    let providerOrWallet: Wallet | ethers.providers.BaseProvider;
    let contractAddress: IContractAddress;

    if (providerConfig.name === "infura") {
      provider = new ethers.providers.InfuraProvider(
        providerConfig.network,
        providerConfig.apiKey
      );
      // Check if the network is supported
      contractAddress = contractAddressInNetwork[providerConfig.network];
      if (contractAddress === undefined) {
        throw new ConfigError(`network ${providerConfig.network} is not supported`);
      }
      // If user provides `customContractAddress`, use it.
      if (providerConfig.customContractAddress !== undefined) {
        contractAddress = providerConfig.customContractAddress;
      }
    } else if (providerConfig.name === "web3") {
      provider = new ethers.providers.JsonRpcProvider(
        providerConfig.url,
        providerConfig.network,
      );

      // If user provides `customContractAddress`, use it.
      if (providerConfig.customContractAddress !== undefined) {
        contractAddress = providerConfig.customContractAddress;
      } else {
        if (providerConfig.network !== undefined) {
          // Check if the network is supported
          const defaultContractAddress = contractAddressInNetwork[providerConfig.network];
          if (defaultContractAddress === undefined) {
            throw new ConfigError(`network ${providerConfig.network} is not supported`);
          } else {
            contractAddress = defaultContractAddress;
          }
        } else {
          throw new ConfigError(
            'both network and customContractAddress are not specified'
          );
        }
      }
    } else {
      throw new ConfigError(`network is not supported`);
    }
    try {
      const adminConfig = this.getAdminConfig();
      providerOrWallet = new ethers.Wallet(adminConfig.adminEthereumPrivkey, provider);
    } catch (e) {
      if (e instanceof ConfigError) {
        providerOrWallet = provider;
      } else {
        throw e;
      }
    }
    const c = new ethers.Contract(
      contractAddress.address,
      abi,
      providerOrWallet
    );
    return new BlindFindContract(c, contractAddress.atBlock);
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
        throw new ConfigError(
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
      provider: {
        network: defaults.network,
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
