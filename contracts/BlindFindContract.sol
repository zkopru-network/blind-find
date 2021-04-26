//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

contract BlindFindContract {

  event UpdateHubRegistryTree(
    uint256 root
  );
  event UpdateHubConnectionTree(
    uint256 root
  );

  uint256 public latestHubRegistryTreeRoot;
  uint256 public latestHubConnectionTreeRoot;
  address public admin;

  constructor() {
    admin = msg.sender;
  }

  function updateHubRegistryTree(uint256 root) public {
    require (msg.sender == admin, "only admin can update the latest merkle root");
    latestHubRegistryTreeRoot = root;
    emit UpdateHubRegistryTree(latestHubRegistryTreeRoot);
  }

  function updateHubConnectionTree(uint256 root) public {
    require (msg.sender == admin, "only admin can update the latest merkle root");
    latestHubConnectionTreeRoot = root;
    emit UpdateHubConnectionTree(latestHubConnectionTreeRoot);
  }

}
