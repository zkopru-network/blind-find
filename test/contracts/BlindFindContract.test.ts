import { expect } from 'chai';

import { ethers } from "hardhat";
import { BigNumber, Signer, BigNumberish, Contract } from "ethers";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

const bigNumberToBigInt = (n: BigNumber) => {
  return BigInt(n.toString());
}

describe("BlindFindContract", function() {
  let accounts: SignerWithAddress[];
  let contract: Contract;
  let admin: SignerWithAddress;
  let nonAdmin: SignerWithAddress;

  before(async () => {
    accounts = await ethers.getSigners();
    const BlindFindContract = await ethers.getContractFactory("BlindFindContract");
    contract = await BlindFindContract.deploy();
    await contract.deployed();
    admin = accounts[0];
    nonAdmin = accounts[1];
  });

  it("is the deployer the admin", async () => {

    expect(await contract.admin()).to.equal(admin.address);
  });

  /*
    Test `updateMerkleRoot`
      0. Only admin can call this function.
      1. Update `latestMerkleRoot`.
      2. Emit `UpdateMerkleRoot` event.
  */
  it('should be 0x00 as the default latestMerkleRoot', async () => {
    expect(bigNumberToBigInt(await contract.latestMerkleRoot())).to.eql(BigInt(0));
  });

  it('should fail when non admin tries to update merkle root', async () => {
    const newMerkleRoot = BigInt(1);
    const callByNonAdmin = async () => {
      const contractCallByNonAdmin = new Contract(contract.address, contract.interface, nonAdmin);
      await contractCallByNonAdmin.updateMerkleRoot(newMerkleRoot);
    }
    await expect(callByNonAdmin()).to.revertedWith("only admin can update the latest merkle root");
  });

  it('should succeed when admin update the merkle root', async () => {
    const eventFilter = contract.filters.UpdateMerkleRoot();
    const firstMerkleRoot = BigInt(1);
    const secondMerkleRoot = BigInt(2);
    // No `updateMerkleRoot` event before calling `updateMerkleRoot`.
    expect((await contract.queryFilter(eventFilter)).length).to.eql(0);
    // Update 1st time.
    await contract.updateMerkleRoot(firstMerkleRoot);
    expect(bigNumberToBigInt(await contract.latestMerkleRoot())).to.eql(firstMerkleRoot);
    expect((await contract.queryFilter(eventFilter)).length).to.eql(1);
    // Update second time.
    await contract.updateMerkleRoot(secondMerkleRoot);
    expect(bigNumberToBigInt(await contract.latestMerkleRoot())).to.eql(secondMerkleRoot);
    const events = await contract.queryFilter(eventFilter);
    expect(events.length).to.eql(2);

    console.log(events[0]);
  });

});
