import { genKeypair, Keypair } from "maci-crypto";
import {
  HubRegistry,
  HubRegistryTree,
  prefixRegisterNewHub,
  signMsg
} from "./";

export const hubRegistryFactory = (
  adminKeypair?: Keypair,
  hubKeypair?: Keypair
): HubRegistry => {
  if (hubKeypair === undefined) {
    hubKeypair = genKeypair();
  }
  if (adminKeypair === undefined) {
    adminKeypair = genKeypair();
  }
  const sig = signMsg(hubKeypair.privKey, prefixRegisterNewHub);
  const registry = new HubRegistry(sig, hubKeypair.pubKey);
  registry.adminSign(adminKeypair);
  return registry;
};

export const hubRegistryTreeFactory = (
  hubs?: Keypair[],
  levels = 5,
  adminKeypair?: Keypair
): HubRegistryTree => {
  if (adminKeypair === undefined) {
    adminKeypair = genKeypair();
  }
  const tree = new HubRegistryTree(levels);
  if (hubs === undefined) {
    return tree;
  }
  if (hubs.length > 2 ** levels) {
    throw new Error(
      "num leaves should not be greater than 2**levels: " +
        `hubs.length=${hubs.length}, levels=${levels}`
    );
  }
  for (let i = 0; i < hubs.length; i++) {
    const registry = hubRegistryFactory(adminKeypair);
    tree.insert(registry);
  }
  return tree;
};
