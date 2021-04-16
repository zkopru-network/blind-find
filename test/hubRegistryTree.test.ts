import {
  adminAddressFactory,
  hubRegistryFactory,
  hubRegistryTreeFactory
} from "./factories";
import { HubRegistry, HubRegistryTree } from "../src";
import { secretFactory } from "../src/smp/v4/factories";
import { genKeypair } from "maci-crypto";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("HubRegistry", () => {
  const registry = hubRegistryFactory();

  it("`verify` succeeds", () => {
    expect(registry.verify()).to.be.true;
  });

  it("`verify` fails if the signature is wrong", () => {
    registry.obj.sig.S = secretFactory();
    expect(registry.verify()).to.be.false;
  });
});

describe("HubRegistryTree", () => {
  it("constructor", () => {
    new HubRegistryTree();
  });
  it("factory", () => {
    const adminAddress = adminAddressFactory();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const tree = hubRegistryTreeFactory(hubs, 5, adminAddress);
    for (let i = 0; i < tree.length; i++) {
      const leaf = tree.leaves[i] as HubRegistry;
      expect(leaf.verify()).to.be.true;
      expect(leaf.obj.adminAddress).to.eql(adminAddress);
    }
    // Fails when `hubs.length > 2 ** levels`
    expect(() => {
      hubRegistryTreeFactory(hubs, 1);
    }).to.throw;
  });
});
