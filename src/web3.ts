import { BigNumber, Contract, Event } from "ethers";

const bigNumberToBigInt = (n: BigNumber) => {
  return BigInt(n.toString());
};

export class BlindFindContract {
  constructor(readonly contract: Contract, readonly startBlock?: number) {}

  public get address() {
    return this.contract.address;
  }

  public get interface() {
    return this.contract.interface;
  }

  async updateMerkleRoot(merkleRoot: BigInt): Promise<void> {
    await this.contract.updateMerkleRoot(merkleRoot);
  }

  async getLatestMerkleRoot(): Promise<BigInt> {
    return bigNumberToBigInt(await this.contract.latestMerkleRoot());
  }

  async getAdmin(): Promise<string> {
    return await this.contract.admin();
  }

  private parseEvent(event: Event) {
    if (event.args === undefined) {
      throw new Error("event doesn't have args field");
    }
    const merkleRoot = event.args.merkleRoot;
    return bigNumberToBigInt(merkleRoot);
  }

  // NOTE: The easiest way is to fetch 'em all.
  //  To make it more efficient, we can cache and listen to new events.
  //  But this is a tradeoff between event maintainence due to reorg and efficiency.
  async getAllMerkleRoots(): Promise<BigInt[]> {
    const eventFilter = this.contract.filters.UpdateMerkleRoot();
    const events = await this.contract.queryFilter(
      eventFilter,
      this.startBlock
    );
    return events.map(this.parseEvent);
  }
}
