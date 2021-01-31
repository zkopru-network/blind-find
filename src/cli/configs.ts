import * as fs from "fs";
import { stringifyBigInts, unstringifyBigInts } from "maci-crypto";
import * as path from "path";
import YAML from "yaml";

import * as defaults from "./defaults";
import {
  NoUserConfigs,
  IncompleteConfig,
  UnsupportedNetwork
} from "./exceptions";

interface IContractAddress {
  [network: string]: { address: string; atBlock: number };
}

interface IAdminConfig {
  adminEthereumPrivkey?: string;
}

interface IHubConfig {
  blindFindPrivkey: BigInt;
}

interface IUserConfig {
  blindFindPrivkey: BigInt;
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

interface IConfig {
  network: INetworkConfig;
  admin?: IAdminConfig;
  hub?: IHubConfig;
  user?: IUserConfig;
}

export interface IContractInfo {
  abi: any;
  networks: IContractAddress;
}

export const contractInfo: IContractInfo = {
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

export const configTemplate: IConfig = {
  network: {
    network: defaults.network,
    provider: {
      name: defaults.provider,
      apiKey: "A123"
    }
  },
  admin: {
    adminEthereumPrivkey: "0x123"
  },
  hub: {
    blindFindPrivkey: BigInt("456")
  },
  user: {
    blindFindPrivkey: BigInt("789")
  }
};

export const parseNetworkConfig = (config: IConfig): INetworkConfig => {
  // Check config.netwrok
  const network = config.network;
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
    // TODO: Support 'web3'
  } else {
    throw new UnsupportedNetwork(`${provider.name} is not supported yet`);
  }
  return config.network;
};

export const parseAdminConfig = (config: IConfig): IAdminConfig => {
  // Check config.user
  const admin = config.admin;
  if (admin === undefined) {
    throw new IncompleteConfig("admin is not specified");
  }
  if (admin.adminEthereumPrivkey === undefined) {
    throw new IncompleteConfig("admin.adminEthereumPrivkey is not specified");
  }
  if (typeof admin.adminEthereumPrivkey !== "string") {
    throw new IncompleteConfig("admin.adminEthereumPrivkey should be a string");
  }
  return admin;
};

export const parseHubConfig = (config: IConfig): IHubConfig => {
  // Check config.user
  const hub = config.hub;
  if (hub === undefined) {
    throw new IncompleteConfig("hub is not specified");
  }
  if (hub.blindFindPrivkey === undefined) {
    throw new IncompleteConfig("hub.blindFindPrivkey is not specified");
  }
  if (typeof hub.blindFindPrivkey !== "bigint") {
    throw new IncompleteConfig("hub.blindFindPrivkey should be a bigint");
  }
  return hub;
};

export const parseUserConfig = (config: IConfig): IUserConfig => {
  // Check config.user
  const user = config.user;
  if (user === undefined) {
    throw new IncompleteConfig("user is not specified");
  }
  if (user.blindFindPrivkey === undefined) {
    throw new IncompleteConfig("user.blindFindPrivkey is not specified");
  }
  if (typeof user.blindFindPrivkey !== "bigint") {
    throw new IncompleteConfig("user.blindFindPrivkey should be a bigint");
  }
  return user;
};

export const loadConfigs = async (
  filePath: string = defaults.configsPath
): Promise<IConfig> => {
  try {
    const configString = await fs.promises.readFile(filePath, "utf-8");
    const configs = unstringifyBigInts(YAML.parse(configString));
    return {
      network: parseNetworkConfig(configs),
      admin: configs.admin,
      hub: configs.hub,
      user: configs.user
    };
  } catch (e) {
    // If no `configs.yaml` is found, provide a template.
    if (e.code === "ENOENT") {
      // mkdir -p `filePath`
      const dirName = path.dirname(filePath);
      await fs.promises.mkdir(dirName, { recursive: true });
      // Write config template
      const templateYAML = YAML.stringify(stringifyBigInts(configTemplate));
      await fs.promises.writeFile(filePath, templateYAML, "utf-8");
      throw new NoUserConfigs(
        `${filePath} is not found and thus a template is generated. ` +
          "Complete the template and try again."
      );
    } else {
      throw e;
    }
  }
};
