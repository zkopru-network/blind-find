import { expect } from "chai";

import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BlindFindContract } from "../../src/web3";

describe("Blind Find Contract", function() {
  let accounts: SignerWithAddress[];
  let contract: BlindFindContract;
  let admin: SignerWithAddress;
  let nonAdmin: SignerWithAddress;

  before(async () => {
    accounts = await ethers.getSigners();
    const BlindFindContractFactory = await ethers.getContractFactory(
      "BlindFindContract"
    );
    const c = await BlindFindContractFactory.deploy();
    await c.deployed();
    contract = new BlindFindContract(c, 0);

    admin = accounts[0];
    nonAdmin = accounts[1];
  });

  it("the admin of the contract should be the deployer", async () => {
    expect(await contract.getAdmin()).to.equal(BigInt(admin.address));
  });

  it("should be 0x00 as the default latestMerkleRoot", async () => {
    expect(await contract.getLatestHubRegistryTreeRoot()).to.eql(BigInt(0));
  });

  it("should fail when non admin tries to update merkle root", async () => {
    const newMerkleRoot = BigInt(1);
    const callByNonAdmin = async () => {
      const contractCallByNonAdmin = new Contract(
        contract.address,
        contract.interface,
        nonAdmin
      );
      await contractCallByNonAdmin.updateHubRegistryTree(newMerkleRoot);
    };
    await expect(callByNonAdmin()).to.be.revertedWith(
      "only admin can update the latest merkle root"
    );
  });

  it("should succeed when admin update the merkle root", async () => {
    const firstMerkleRoot = BigInt(1);
    const secondMerkleRoot = BigInt(2);
    // No `updateHubRegistryTree` event before calling `updateHubRegistryTree`.
    expect((await contract.getAllHubRegistryTreeRoots()).size).to.eql(0);
    // Update HubRegistry Tree Root
    // Update 1st time.
    await contract.updateHubRegistryTree(firstMerkleRoot);
    expect(await contract.getLatestHubRegistryTreeRoot()).to.eql(firstMerkleRoot);
    expect((await contract.getAllHubRegistryTreeRoots()).size).to.eql(1);
    // Update second time.
    await contract.updateHubRegistryTree(secondMerkleRoot);
    expect(await contract.getLatestHubRegistryTreeRoot()).to.eql(secondMerkleRoot);

    // Update HubConnection Tree Root
    // Update 1st time.
    await contract.updateHubConnectionTree(firstMerkleRoot);
    expect(await contract.getLatestHubConnectionTreeRoot()).to.eql(firstMerkleRoot);
    expect((await contract.getAllHubConnectionTreeRoots()).size).to.eql(1);
    // Update second time.
    await contract.updateHubConnectionTree(secondMerkleRoot);
    expect(await contract.getLatestHubConnectionTreeRoot()).to.eql(secondMerkleRoot);

    // Ensure all events are emitted and parsed correctly.
    const hubRegistryTreeRoots = await contract.getAllHubRegistryTreeRoots();
    expect(hubRegistryTreeRoots.size).to.eql(2);
    expect(hubRegistryTreeRoots.has(firstMerkleRoot)).to.be.true;
    expect(hubRegistryTreeRoots.has(secondMerkleRoot)).to.be.true;

    const hubConnectionTreeRoots = await contract.getAllHubConnectionTreeRoots();
    expect(hubConnectionTreeRoots.size).to.eql(2);
    expect(hubConnectionTreeRoots.has(firstMerkleRoot)).to.be.true;
    expect(hubConnectionTreeRoots.has(secondMerkleRoot)).to.be.true;
  });
});
