import {
  adminAddressFactory,
  hubRegistryFactory,
  hubRegistryTreeFactory
} from "../src/factories";
import { HubRegistryTree } from "../src";
import { secretFactory } from "../src/smp/v4/factories";
import { genKeypair } from "maci-crypto";

describe("HubRegistry", () => {
  const registry = hubRegistryFactory();

  test("`verify` succeeds", () => {
    expect(registry.verify()).toBeTruthy();
  });

  test("`verify` fails if the signature is wrong", () => {
    registry.sig.S = secretFactory();
    expect(registry.verify()).toBeFalsy();
  });
});

describe("HubRegistryTree", () => {
  test("constructor", () => {
    new HubRegistryTree();
  });
  test("factory", () => {
    const adminAddress = adminAddressFactory();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const tree = hubRegistryTreeFactory(hubs, 5, adminAddress);
    for (let i = 0; i < tree.length; i++) {
      expect(tree.leaves[i].verify()).toBeTruthy();
      expect(tree.leaves[i].adminAddress).toEqual(adminAddress);
    }
    // Fails when `hubs.length > 2 ** levels`
    expect(() => {
      hubRegistryTreeFactory(hubs, 1);
    }).toThrow();
  });
});
