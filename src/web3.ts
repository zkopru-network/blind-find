import { BigNumber, Contract, ethers, Event } from "ethers";
import { SNARK_FIELD_SIZE } from "maci-crypto";

const bigNumberToBigInt = (n: BigNumber) => {
  return BigInt(n.toString());
};

export const ethAddressToBigInt = (address: string): BigInt => {
  const addressBigInt = BigInt(address);
  if (addressBigInt >= SNARK_FIELD_SIZE) {
    throw new Error(
      `ethereum address should be smaller than field size: addressBigInt=${addressBigInt}, ` +
      `SNARK_FIELD_SIZE=${SNARK_FIELD_SIZE}`
    );
  }
  return addressBigInt;
}

export const bigIntToEthAddress = (n: BigInt): string => {
  return ethers.utils.getAddress('0x' + n.toString(16));
}

export class BlindFindContract {
  constructor(readonly contract: Contract, readonly startBlock?: number) {}

  public get address() {
    return this.contract.address;
  }

  public get interface() {
    return this.contract.interface;
  }

  async updateHubRegistryTree(merkleRoot: BigInt): Promise<void> {
    await this.contract.updateHubRegistryTree(merkleRoot);
  }

  async getLatestMerkleRoot(): Promise<BigInt> {
    return bigNumberToBigInt(await this.contract.latestHubRegistryTreeRoot());
  }

  async getAdmin(): Promise<BigInt> {
    const ethAddress = await this.contract.admin();
    return ethAddressToBigInt(ethAddress);
  }

  private parseEvent(event: Event) {
    if (event.args === undefined) {
      throw new Error("event doesn't have args field");
    }
    const merkleRoot = event.args.root;
    return bigNumberToBigInt(merkleRoot);
  }

  // NOTE: The easiest way is to fetch 'em all.
  //  To make it more efficient, we can cache and listen to new events.
  //  But this is a tradeoff between event maintainence due to reorg and efficiency.
  async getAllMerkleRoots(): Promise<Set<BigInt>> {
    const eventFilter = this.contract.filters.UpdateHubRegistryTree();
    const events = await this.contract.queryFilter(
      eventFilter,
      this.startBlock
    );
    return new Set<BigInt>(events.map(this.parseEvent));
  }
}
