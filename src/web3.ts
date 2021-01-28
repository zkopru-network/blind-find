import { BigNumber, Contract, Event } from "ethers";
import { SNARK_FIELD_SIZE } from "maci-crypto";

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

  async getAdmin(): Promise<BigInt> {
    const address = BigInt(await this.contract.admin());
    if (address >= SNARK_FIELD_SIZE) {
      throw new Error("ethereum address should be smaller than field size");
    }
    return address;
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
  async getAllMerkleRoots(): Promise<Set<BigInt>> {
    const eventFilter = this.contract.filters.UpdateMerkleRoot();
    const events = await this.contract.queryFilter(
      eventFilter,
      this.startBlock
    );
    return new Set<BigInt>(events.map(this.parseEvent));
  }
}
