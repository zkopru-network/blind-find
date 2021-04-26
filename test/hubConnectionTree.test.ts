import { hubConnectionRegistryFactory } from "./factories";
import { HubConnectionRegistry, HubConnectionRegistryTree } from "../src";
import { secretFactory } from "../src/smp/v4/factories";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("HubConnectionRegistry", () => {
  const registry = hubConnectionRegistryFactory();

  it("`verify` succeeds", () => {
    expect(registry.verify()).to.be.true;
  });

  it("`verify` fails if a signature is wrong", () => {
    registry.toObj().hubSig0.S = secretFactory();
    expect(registry.verify()).to.be.false;
  });
});

describe("HubConnectionRegistryTree", () => {
  let tree: HubConnectionRegistryTree;
  let hubConnection0: HubConnectionRegistry;
  let hubConnection1: HubConnectionRegistry;
  before(() => {
    tree = new HubConnectionRegistryTree();
  });
  it("insert", () => {
    expect(tree.length).to.eql(0);
    hubConnection0 = hubConnectionRegistryFactory();
    tree.insert(hubConnection0);
    expect(tree.length).to.eql(1);
    hubConnection1 = hubConnectionRegistryFactory();
    tree.insert(hubConnection1);
    expect(tree.length).to.eql(2);
  });
  it("getIndex", () => {
    expect(tree.getIndex(hubConnection0)).to.eql(0);
    expect(tree.getIndex(hubConnection1)).to.eql(1);

    const unseenHubConnection = hubConnectionRegistryFactory();
    expect(tree.getIndex(unseenHubConnection)).to.be.undefined;
  });
});
