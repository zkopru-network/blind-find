import {
  genProofOfSMP,
  genProofSuccessfulSMP,
  verifyProofOfSMP,
  verifyProofSuccessfulSMP,
  verifyProofIndirectConnection,
  TProof, genProofSaltedConnection, verifyProofSaltedConnection
} from "../../src/circuits";
import { proofIndirectConnectionInputsFactory } from ".././factories";
import { babyJubPointFactory } from "../../src/smp/v4/factories";
import { bigIntFactoryExclude, factoryExclude } from "../utils";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Test `genProof` and `verifyProof`", function() {
  this.timeout(300000);

  const numHubs = 3;
  const inputs = proofIndirectConnectionInputsFactory(numHubs);
  let proofOfSMP: TProof;
  let proofSuccessfulSMP: TProof;
  let proofSaltedConnections: TProof[];

  before(async () => {
    proofOfSMP = await genProofOfSMP(inputs);
    proofSuccessfulSMP = await genProofSuccessfulSMP(inputs);
    expect(inputs.proofSaltedConnectionInputs.length).to.eq(numHubs - 1);

    proofSaltedConnections = [];
    for (const p of inputs.proofSaltedConnectionInputs) {
      proofSaltedConnections.push(await genProofSaltedConnection(p));
    }
  });

  it("proofOfSMP", async () => {
    const res = await verifyProofOfSMP(proofOfSMP);
    expect(res).to.be.true;

    // Invalid public
    const invalidPublicSignals = [...proofOfSMP.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofOfSMP({
        proof: proofOfSMP.proof,
        publicSignals: invalidPublicSignals
      })
    ).to.be.rejected;
  });

  it("proofSuccessfulSMP", async () => {
    expect(await verifyProofSuccessfulSMP(proofSuccessfulSMP)).to.be.true;

    // Invalid public
    const invalidPublicSignals = [...proofSuccessfulSMP.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofSuccessfulSMP({
        proof: proofSuccessfulSMP.proof,
        publicSignals: invalidPublicSignals
      })
    ).to.be.rejected;
  });

  it("proofSaltedConnection", async () => {
    const proofSaltedConnection = proofSaltedConnections[0];
    expect(await verifyProofSaltedConnection(proofSaltedConnection)).to.be.true;

    // Invalid public
    const invalidPublicSignals = [...proofSaltedConnection.publicSignals];
    invalidPublicSignals[0] = bigIntFactoryExclude(invalidPublicSignals);
    await expect(
      verifyProofSaltedConnection({
        proof: proofSaltedConnection.proof,
        publicSignals: invalidPublicSignals
      })
    ).to.be.rejected;
  });

  it("proof indirect connection (proofOfSMP, proofSaltedConnections, and proofSuccessfulSMP)", async () => {
    const res = await verifyProofIndirectConnection(
      {
        pubkeyA: inputs.pubkeyA,
        pubkeyC: inputs.pubkeyC,
        adminAddress: inputs.adminAddress,
        proofOfSMP,
        proofSuccessfulSMP,
        proofSaltedConnections,
      },
      new Set([inputs.proof.root]),
      new Set([inputs.hubConnectionTreeRoot]),
    );
    expect(res).to.be.true;

    // Fails when invalid public keys are passed.
    const anotherPubkey = factoryExclude(
      [inputs.pubkeyA, inputs.pubkeyC],
      () => {
        return babyJubPointFactory().point;
      },
      (a, b) => a === b
    );
    const anotherRoot = bigIntFactoryExclude([inputs.proof.root, inputs.hubConnectionTreeRoot]);
    const anotherAdminAddress = bigIntFactoryExclude([inputs.adminAddress]);
    // Wrong pubkeyA
    expect(
      await verifyProofIndirectConnection(
        {
          pubkeyA: anotherPubkey,
          pubkeyC: inputs.pubkeyC,
          adminAddress: inputs.adminAddress,
          proofOfSMP,
          proofSuccessfulSMP,
          proofSaltedConnections
        },
        new Set([inputs.proof.root]),
        new Set([inputs.hubConnectionTreeRoot]),
      )
    ).to.be.false;
    // Wrong pubkeyC
    expect(
      await verifyProofIndirectConnection(
        {
          pubkeyA: inputs.pubkeyA,
          pubkeyC: anotherPubkey,
          adminAddress: inputs.adminAddress,
          proofOfSMP,
          proofSuccessfulSMP,
          proofSaltedConnections
        },
        new Set([inputs.proof.root]),
        new Set([inputs.hubConnectionTreeRoot]),
      )
    ).to.be.false;
    // Wrong pubkeyAdmin
    expect(
      await verifyProofIndirectConnection(
        {
          pubkeyA: inputs.pubkeyA,
          pubkeyC: inputs.pubkeyC,
          adminAddress: anotherAdminAddress,
          proofOfSMP,
          proofSuccessfulSMP,
          proofSaltedConnections
        },
        new Set([inputs.proof.root]),
        new Set([inputs.hubConnectionTreeRoot]),
      )
    ).to.be.false;
    // Wrong hub registry tree root
    expect(
      await verifyProofIndirectConnection(
        {
          pubkeyA: inputs.pubkeyA,
          pubkeyC: inputs.pubkeyC,
          adminAddress: inputs.adminAddress,
          proofOfSMP,
          proofSuccessfulSMP,
          proofSaltedConnections
        },
        new Set([anotherRoot]),
        new Set([inputs.hubConnectionTreeRoot]),
      )
    ).to.be.false;
    // Wrong hub connection tree root
    expect(
      await verifyProofIndirectConnection(
        {
          pubkeyA: inputs.pubkeyA,
          pubkeyC: inputs.pubkeyC,
          adminAddress: inputs.adminAddress,
          proofOfSMP,
          proofSuccessfulSMP,
          proofSaltedConnections
        },
        new Set([inputs.proof.root]),
        new Set([anotherRoot]),
      )
    ).to.be.false;
  });
});
