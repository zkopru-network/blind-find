const hre = require("hardhat");

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("BlindFindContract");
  const instance = await Contract.deploy();

  console.log("Blind find contract deployed to:", instance.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
