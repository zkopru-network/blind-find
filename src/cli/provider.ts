import { ethers, Wallet } from "ethers";
import { contractInfo, INetworkConfig } from "./configs";
import { UnsupportedNetwork } from "./exceptions";
import { BlindFindContract } from "../web3";

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
