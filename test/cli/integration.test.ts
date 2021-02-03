import * as path from "path";
import * as shell from "shelljs";
import * as fs from "fs";
import YAML from "yaml";
import tmp from "tmp-promise";

import { expect } from 'chai';
import { ethers } from "hardhat";

import { configsFileName } from "../../src/cli/constants";

import { exec, parsePrintedObj } from './utils';
import { BlindFindContract } from "../../src/web3";
import { genPrivKey, stringifyBigInts } from "maci-crypto";

const url = "http://localhost:8545";
const hardhatDefaultPrivkey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
tmp.setGracefulCleanup();

class Role {
    constructor(
        readonly dataDir: tmp.DirectoryResult,
        readonly roleName: string,
    ) {

    }

    exec(cmd: string, options?: any) {
        return exec(`--data-dir ${this.dataDir.path} ${this.roleName} ${cmd}`, options);
    }

    async cleanup() {
        await this.dataDir.cleanup()
    }
}

const createDataDir = async (
    contractAddress: string,
    roleName: string,
): Promise<Role> => {
    const networkOptions = {
        provider: {
            name: "web3",
            url: url,
            customContractAddress: {
            address: contractAddress,
            atBlock: 0,
            }
        }
    };
    const blindFindPrivkey = genPrivKey();
    let userOptions;
    if (roleName === 'admin') {
        userOptions = {
            network: networkOptions,
            blindFindPrivkey: blindFindPrivkey,
            admin: {
                adminEthereumPrivkey: hardhatDefaultPrivkey
            }
        };
    } else {
        userOptions = {
            network: networkOptions,
            blindFindPrivkey: blindFindPrivkey,
        };
    }
    const yamlString = YAML.stringify(stringifyBigInts(userOptions));
    const dir = await tmp.dir({ unsafeCleanup: true });
    const configFilePath = path.join(dir.path, configsFileName);
    await fs.promises.writeFile(configFilePath, yamlString, 'utf-8');
    return new Role(dir, roleName);
};

// TODO:
//  - 1. Create user config path. Each user owns their own dataDir.
//  - 2. Create an Admin
//  - 3. Create a Hub
//  - 4. Hub creates hubRegistry
//  - 5. Admin addHubs and gets hubRegistryWithProof
//  - 6. Hub gets hubRegistryWithProof and setRegistryWithProof
//  - 7. Hub runs through start
//  - 8. Create a User `userJoined`, join the hub.
//  - 9. Create a User `userAnother`
//  - 10. `userAnother` successfully searches for `userJoined`.

describe("Integration test for roles", function () {
  this.timeout(1000000);
  let hardhatNode;

  let admin: Role;
  let hub: Role;
  let userJoined: Role;
  let userAnother: Role;

  before(async () => {
    hardhatNode = shell.exec('npx hardhat node', { async: true, silent: true });

    // Deploy contract to hardhat node
    const provider = new ethers.providers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(hardhatDefaultPrivkey, provider);
    const BlindFindContractFactory = await ethers.getContractFactory(
        "BlindFindContract",
        wallet,
    );
    const c = await BlindFindContractFactory.deploy();
    await c.deployed();
    const contractAddress = c.address;

    // Create each role
    admin = await createDataDir(contractAddress, "admin");
    hub = await createDataDir(contractAddress, "hub");
    userJoined = await createDataDir(contractAddress, "user");
    userAnother = await createDataDir(contractAddress, "user");
  });

  after(async () => {
    hardhatNode.kill();
    await admin.cleanup();
    await hub.cleanup();
    await userJoined.cleanup();
    await userAnother.cleanup();
  })

  it("", async () => {
      const keypair = hub.exec('getKeypair').stdout;
      console.log(keypair);
  });
});

