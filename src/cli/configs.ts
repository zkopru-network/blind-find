import * as fs from "fs";
import {
  genPrivKey,
  PrivKey,
  stringifyBigInts,
  unstringifyBigInts
} from "maci-crypto";
import * as path from "path";
import YAML from "yaml";
import { TRateLimitParams } from "../websocket";

import * as defaults from "./defaults";
import {
  NoUserConfigs,
  IncompleteConfig,
  UnsupportedNetwork
} from "./exceptions";

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
  network: INetworkConfig;
  blindFindPrivkey: PrivKey;
  admin?: IAdminConfig;
  hub?: IHubConfig;
  // dbPath: string;
}

// class BlindFindConfig implements IConfig {

// }


export const createConfigTemplate = () => {
  return {
    network: {
      network: "kovan",
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

export const parseNetworkConfig = (config: IConfig): INetworkConfig => {
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
    // TODO: Support JSONRPC
  } else {
    throw new UnsupportedNetwork(`${provider.name} is not supported yet`);
  }
  return config.network;
};

export const parseAdminConfig = (config: IConfig): IAdminConfig => {
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
  const hub = config.hub;
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
};

// TODO: Refactor
//  - Load **options** and configs from configs.yaml
//  - Create `IConfig` based on the options, configs, and the defaults.

export const loadConfigs = async (dataDir: string): Promise<IConfig> => {
  const configsPath = path.join(dataDir, defaults.configsFileName);
  try {
    const configString = await fs.promises.readFile(configsPath, "utf-8");
    const configs = unstringifyBigInts(YAML.parse(configString));
    const networkConfig = parseNetworkConfig(configs);
    if (configs.blindFindPrivkey === undefined) {
      throw new IncompleteConfig("blind find privkey is not found");
    }
    if (typeof configs.blindFindPrivkey !== "bigint") {
      throw new IncompleteConfig("blind find privkey is in a wrong type");
    }
    return {
      network: networkConfig,
      blindFindPrivkey: configs.blindFindPrivkey,
      admin: configs.admin,
      hub: configs.hub
    };
  } catch (e) {
    // If no `configs.yaml` is found, provide a template.
    if (e.code === "ENOENT") {
      // mkdir -p `filePath`
      const dirName = path.dirname(configsPath);
      await fs.promises.mkdir(dirName, { recursive: true });
      // Write config template
      const templateYAML = YAML.stringify(
        stringifyBigInts(createConfigTemplate())
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
};
