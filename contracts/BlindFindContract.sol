//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

contract BlindFindContract {

  event UpdateMerkleRoot(
    uint256 merkleRoot
  );

  uint256 public latestMerkleRoot;
  address public admin;

  constructor() {
    admin = msg.sender;
    console.log("BlindFindContract: is deployed by", admin);
  }

  function updateMerkleRoot(uint256 root) public {
    require (msg.sender == admin, "only admin can update the latest merkle root");
    latestMerkleRoot = root;
    emit UpdateMerkleRoot(latestMerkleRoot);
    console.log("BlindFindContract: merkle root is updated to be", latestMerkleRoot);
  }
}
