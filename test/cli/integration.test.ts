import * as shell from "shelljs";

import { expect } from 'chai';
import { ethers } from "hardhat";

import { exec, parsePrintedObj } from './utils';
import { BlindFindContract } from "../../src/web3";

const url = "http://localhost:8545";
const hardhatDefaultPrivkey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const createConfigsYAMLTemplate = async () => {
    /*
network:
  provider:
    name: infura
    apiKey: "124c33af67614f11802a2516dbec889f"
    network: kovan
blindFindPrivkey: "17604531225586055501083113516308994756378518574124603404445921994652983823292"
admin:
  adminEthereumPrivkey: "0x8c2a40c2de5d714d77b19c5dfa793fcee07605d982d647d17a587e9959256841"
    */
    return {
      network: {
        provider: {
          name: "web3",
          url: url,
          customContractAddress: '0x1234',
        }
      },
      blindFindPrivkey: '0x123',
      admin: {
        adminEthereumPrivkey: hardhatDefaultPrivkey
      }
    };
};

describe("Integration test for roles", function () {
  this.timeout(10000000);
  let hardhatNode;
  let contract: BlindFindContract;

  before(async () => {
    // hardhatNode = shell.exec('npx hardhat node', { async: true });

    const provider = new ethers.providers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(hardhatDefaultPrivkey, provider);
    const BlindFindContractFactory = await ethers.getContractFactory(
        "BlindFindContract",
        wallet,
    );
    const c = await BlindFindContractFactory.deploy();
    await c.deployed();
    contract = new BlindFindContract(c, 0);
  });

  after(() => {
    hardhatNode.kill();
  })

  it("", async () => {

        // const child = shell.exec('echo "1"; sleep 3; echo "2";', { async: true });
      await new Promise((res, rej) => {
        setInterval(() => {
            res();
        }, 100000);
      });
  });
});

