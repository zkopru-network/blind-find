import { hubRegistryFactory, hubRegistryTreeFactory } from "../src/factories";
import {
  signMsg,
  prefixRegisterNewHub,
  HubRegistry,
  HubRegistryTree
} from "../src";
import { ValueError } from "../src/smp/exceptions";
import { secretFactory } from "../src/smp/v4/factories";
import { genKeypair } from "maci-crypto";

describe("HubRegistry", () => {
  const hub = {
    privKey: BigInt(
      "5166517748499818358792828796277113685381929318003838369921249466479974797830"
    ),
    pubKey: [
      BigInt(
        "18751114085243780222438687094569408986044381908182700132467052444873333047230"
      ),
      BigInt(
        "12177043156072963111876505840350043428742975916009628960525359695499616417311"
      )
    ]
  };
  const admin = {
    privKey: BigInt(
      "1019722964269178092490985062389375764077151934799070241073048077380198417679"
    ),
    pubKey: [
      BigInt(
        "12523878555803975718203963541726205872967864225918112353762912978967489482894"
      ),
      BigInt(
        "20618352655769778619343996326073636454014413823721451449827312348843198432017"
      )
    ]
  };
  // deterministic
  const sig = signMsg(hub.privKey, prefixRegisterNewHub);
  const registry = new HubRegistry(sig, hub.pubKey);

  test("fails to verify and hash if it hasn't been signed by admin", () => {
    expect(() => {
      registry.verify();
    }).toThrowError(ValueError);
    expect(() => {
      registry.hash();
    }).toThrowError(ValueError);
  });

  test("`verify` succeeds after the admin signed", () => {
    registry.adminSign(admin);
    expect(registry.verify()).toBeTruthy();
  });

  test("`hash` succeeds after the admin signed", () => {
    expect(
      registry.hash() ===
        BigInt(
          "740445240978766681935077256235590739755586839297375129983927382731930763737"
        )
    ).toBeTruthy();
  });

  test("`verify` fails if the signature is wrong", () => {
    registry.sig.S = secretFactory();
    expect(registry.verify()).toBeFalsy();
  });

  test("factory should create a valid registry", () => {
    const r2 = hubRegistryFactory();
    r2.adminSign(admin);
    expect(r2.verify()).toBeTruthy();
  });
});

describe("HubRegistryTree", () => {
  test("constructor", () => {
    new HubRegistryTree();
  });
  test("factory", () => {
    const admin = genKeypair();
    const hubs = [genKeypair(), genKeypair(), genKeypair()];
    const tree = hubRegistryTreeFactory(hubs, 5, admin);
    for (let i = 0; i < tree.length; i++) {
      expect(tree.leaves[i].verify()).toBeTruthy();
      expect(tree.leaves[i].adminPubkey).toEqual(admin.pubKey);
    }
    // Fails when `hubs.length > 2 ** levels`
    expect(() => {
      hubRegistryTreeFactory(hubs, 1);
    }).toThrow();
  });
});
