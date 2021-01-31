import { HubRegistry } from ".";
import { HubRegistryTreeDB } from "./dataProvider";
import { AlreadyExistsError } from "./exceptions";
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
    try {
      await this.treeDB.insert(e);
    } catch (e) {
      // Don't insert the hubRegistry if it already exists.
      if (e instanceof AlreadyExistsError) {
        return;
      } else {
          throw e;
      }
    }
    const root = this.treeDB.tree.tree.root;
    await this.updateMerkleRoot(root);
  }
}
