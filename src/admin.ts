import { HubRegistry } from ".";
import { HubConnectionRegistryTreeDB, HubRegistryTreeDB } from "./dataProvider";
import { AlreadyExistsError } from "./exceptions";
import { BlindFindContract } from "./web3";

/**
 * In charge of the merkle tree updating.
 * NOTE: should it inherit DataProvider?
 */
export class Admin {
  constructor(
    readonly contract: BlindFindContract,
    readonly hubRegistryTreeDB: HubRegistryTreeDB,
    readonly hubConnectionRegistryTreeDB: HubConnectionRegistryTreeDB,
  ) {}

  private async updateHubRegistryTree(root: BigInt) {
    // NOTE: This function probably needs changing if admin is a multisig
    await this.contract.updateHubRegistryTree(root);
  }

  async insertHubRegistry(e: HubRegistry) {
    try {
      await this.hubRegistryTreeDB.insert(e);
    } catch (e) {
      // Don't insert the hubRegistry if it already exists.
      if (e instanceof AlreadyExistsError) {
        return;
      } else {
        throw e;
      }
    }
    const root = this.hubRegistryTreeDB.tree.tree.root;
    await this.updateHubRegistryTree(root);
  }
}
