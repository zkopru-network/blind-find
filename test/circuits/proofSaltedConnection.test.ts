import { executeCircuit, getSignalByName } from "maci-circuits";

import { compileCircuit } from "./utils";
import { adminAddressFactory, genSortedKeypairs, hubConnectionRegistryFactory, hubRegistryTreeFactory, proofSaltedConnectionInputsFactory } from ".././factories";
import { proofSaltedConnectionInputToCircuitArgs } from "../../src/circuits";
import { HubConnectionRegistryTree } from "../../src";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { genKeypair, stringifyBigInts } from "maci-crypto";
import { isPubkeySame } from "../../src/utils";

// chai.use(chaiAsPromised);
// const expect = chai.expect;


describe("Pubkey selector", function() {
  this.timeout(90000);

  let circuit: any;

  before(async () => {
    circuit = await compileCircuit("testPubkeySelector.circom");
  });

  it("", async () => {
    const pubkeys = [genKeypair().pubKey, genKeypair().pubKey];
    const selector = 1;
    const witness = await executeCircuit(circuit, stringifyBigInts({
      pubkey0: pubkeys[0],
      pubkey1: pubkeys[1],
      selector: selector,
    }));
    const resPubkey = [
      getSignalByName(circuit, witness, "main.out[0]"),
      getSignalByName(circuit, witness, "main.out[1]"),
    ];
    expect(isPubkeySame(pubkeys[selector], resPubkey)).to.be.true;
  });

});

describe("Hub Connection Verifier", function() {
  this.timeout(90000);

  let circuit: any;

  before(async () => {
    circuit = await compileCircuit("testHubConnectionVerifier.circom");
  });

  it("", async () => {
    const registry = hubConnectionRegistryFactory();
    const obj = registry.toSorted();
    const witness = await executeCircuit(circuit, stringifyBigInts({
        hubPubkey0: obj.hubPubkey0,
        hubSig0R8: obj.hubSig0.R8,
        hubSig0S: obj.hubSig0.S,
        hubPubkey1: obj.hubPubkey1,
        hubSig1R8: obj.hubSig1.R8,
        hubSig1S: obj.hubSig1.S,
    }));
    const res = getSignalByName(circuit, witness, "main.valid").toString();
    expect(res).to.eql("1");
  });

});

describe("Circuit of the Proof of Salted Connection", function() {
    this.timeout(300000);

    let circuit: any;

    before(async () => {
      circuit = await compileCircuit("testProofSaltedConnection.circom");
    });

    it("", async () => {
      const [hub0, hub1] = genSortedKeypairs();
      const adminAddress = adminAddressFactory();
      const hubRegistryTree = hubRegistryTreeFactory([hub0, hub1], 32, adminAddress);
      const hubConn = hubConnectionRegistryFactory(hub0, hub1);
      const hubConnTree = new HubConnectionRegistryTree();
      hubConnTree.insert(hubConn);

      const inputs = proofSaltedConnectionInputsFactory(
        0, 1, 0, hubRegistryTree, hubConnTree, adminAddress
      )
      const witness = await executeCircuit(
        circuit,
        proofSaltedConnectionInputToCircuitArgs(inputs),
      );
      const res = getSignalByName(circuit, witness, "main.valid").toString();
      expect(res).to.eql("1");
  });

});
