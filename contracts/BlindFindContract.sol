//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

contract BlindFindContract {

  event UpdateMerkleRoot(
    uint256 merkleRoot
  );

  uint256 public latestMerkleRoot;
  address public admin;

  constructor() {
    admin = msg.sender;
  }

  function updateMerkleRoot(uint256 root) public {
    require (msg.sender == admin, "only admin can update the latest merkle root");
    latestMerkleRoot = root;
    emit UpdateMerkleRoot(latestMerkleRoot);
  }
}
