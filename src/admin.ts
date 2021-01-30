import { HubRegistry } from ".";
import { HubRegistryTreeDB } from "./dataProvider";
import { BlindFindContract } from "./web3";

/**
 * In charge of the merkle tree updating.
 * NOTE: I'm thinking if it should inherit DataProvider.
 */
export class Admin {
  constructor(
    readonly contract: BlindFindContract,
    readonly treeDB: HubRegistryTreeDB
  ) {}

  private async updateMerkleRoot(root: BigInt) {
    // NOTE: This function probably needs changing if admin is a multisig
    await this.contract.updateMerkleRoot(root);
  }

  async insertHubRegistry(e: HubRegistry) {
    await this.treeDB.insert(e);
    const root = this.treeDB.tree.tree.root;
    await this.updateMerkleRoot(root);
  }
}
