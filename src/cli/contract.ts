import { ethers, Wallet } from "ethers";
import { INetworkConfig } from "./configs";
import { UnsupportedNetwork } from "./exceptions";
import { BlindFindContract } from "../web3";

interface IContractAddress {
  [network: string]: { address: string; atBlock: number };
}
interface IContractInfo {
  abi: any;
  networks: IContractAddress;
}

const contractInfo: IContractInfo = {
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

export const getBlindFindContract = (
  networkConfig: INetworkConfig,
  privkey?: string
): BlindFindContract => {
  const providerConfig = networkConfig.provider;
  if (providerConfig.name === "infura") {
    const provider = new ethers.providers.InfuraProvider(
      networkConfig.network,
      providerConfig.apiKey
    );
    const abi = contractInfo.abi;
    const contractDetail = contractInfo.networks[networkConfig.network];
    let providerOrWallet: Wallet | ethers.providers.BaseProvider = provider;
    if (privkey !== undefined) {
      providerOrWallet = new ethers.Wallet(privkey, provider);
    }
    const c = new ethers.Contract(
      contractDetail.address,
      abi,
      providerOrWallet
    );
    return new BlindFindContract(c, contractDetail.atBlock);
  } else {
    throw new UnsupportedNetwork(
      `provider ${providerConfig.name} is not supported yet`
    );
  }
};
