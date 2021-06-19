import * as fs from "fs";
import * as path from "path";
import * as shell from "shelljs";

import {
  hash5,
  PubKey,
  Signature,
  stringifyBigInts,
  unstringifyBigInts
} from "maci-crypto";
import { ValueError } from "../smp/exceptions";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "../smp/v4/serialization";
import { HubConnectionRegistry, HubRegistry } from "..";
import { BabyJubPoint } from "../smp/v4/babyJub";
import { MerkleProof } from "../interfaces";
import { TEthereumAddress } from "../types";
const circom = require("circom");
import tmp from 'tmp-promise';
import { isPubkeySame } from "../utils";

/**
 * Ref
 *  - maci-circuit: https://github.com/appliedzkp/maci/blob/e5e3c2f9f5f0d6b130b1c4b0ee41e6042c0cbcc0/circuits/ts/index.ts#L161
 */

// TODO: Move to configs.ts?
const zkutilPath = "~/.cargo/bin/zkutil";
const circomFilePostfix = ".circom";
const circomDir = `${__dirname}/../../circuits`;
const buildDir = `${__dirname}/../../build`;
const snarkjsCLI = path.join(
  __dirname,
  "../../node_modules/snarkjs/build/cli.cjs"
);
const proofOfSMPPath = path.join(circomDir, "instance/proofOfSMP.circom");
const proofSuccessfulSMPPath = path.join(circomDir, "instance/proofSuccessfulSMP.circom");
const proofSaltedConnectionPath = path.join(circomDir, "instance/proofSaltedConnection.circom");

export const compileAndLoadCircuit = async (circuitPath: string) => {
  const circuit = await circom.tester(path.join(circuitPath));
  await circuit.loadSymbols();
  return circuit;
};

type ProofOfSMPInput = {
  h2: BigInt;
  h3: BigInt;
  r4h: BigInt;
  msg1: SMPMessage1Wire;
  msg2: SMPMessage2Wire;
  msg3: SMPMessage3Wire;
  proof: MerkleProof;
  hubRegistry: HubRegistry;
  pubkeyC: PubKey;
  pubkeyHub: PubKey;
  sigJoinMsgC: Signature;
  sigJoinMsgHub: Signature;
};

type ProofSuccessfulSMPInput = {
  a3: BigInt;
  pa: BabyJubPoint;
  ph: BabyJubPoint;
  rh: BabyJubPoint;
  pubkeyA: PubKey;
  sigRh: Signature;
};

export type ProofSaltedConnectionInput = {
  creator: BigInt;
  creatorHubRegistryMerkleProof: MerkleProof;
  creatorHubRegistry: HubRegistry;
  hubConnectionRegistry: HubConnectionRegistry;
  hubConnectionMerkleProof: MerkleProof;
  adminAddress: TEthereumAddress;
}

type TProof = { proof: any; publicSignals: any };
type TProofIndirectConnection = {
  pubkeyA: PubKey;
  pubkeyC: PubKey;
  adminAddress: TEthereumAddress;
  proofOfSMP: TProof;
  proofSaltedConnections: TProof[];
  proofSuccessfulSMP: TProof;
};

const genProofOfSMP = async (inputs: ProofOfSMPInput) => {
  const args = proofOfSMPInputsToCircuitArgs(inputs);
  return await genProof(proofOfSMPPath, args);
};

const proofOfSMPInputsToCircuitArgs = (inputs: ProofOfSMPInput) => {
  if (!inputs.hubRegistry.verify()) {
    throw new ValueError("registry is invalid");
  }
  const hubRegistryObj = inputs.hubRegistry.toObj();
  const args = stringifyBigInts({
    merklePathElements: inputs.proof.pathElements,
    merklePathIndices: inputs.proof.indices,
    merkleRoot: inputs.proof.root,
    sigHubRegistryR8: hubRegistryObj.sig.R8,
    sigHubRegistryS: hubRegistryObj.sig.S,
    adminAddress: hubRegistryObj.adminAddress,
    pubkeyC: inputs.pubkeyC,
    sigCR8: inputs.sigJoinMsgC.R8,
    sigCS: inputs.sigJoinMsgC.S,
    pubkeyHub: inputs.pubkeyHub,
    saltedPubkeyHub: saltPubkey(inputs.pubkeyHub),
    sigJoinMsgHubR8: inputs.sigJoinMsgHub.R8,
    sigJoinMsgHubS: inputs.sigJoinMsgHub.S,
    h2: inputs.h2,
    h3: inputs.h3,
    r4h: inputs.r4h,
    g2h: inputs.msg1.g2a.point,
    g2hProofC: inputs.msg1.g2aProof.c,
    g2hProofD: inputs.msg1.g2aProof.d,
    g3h: inputs.msg1.g3a.point,
    g3hProofC: inputs.msg1.g3aProof.c,
    g3hProofD: inputs.msg1.g3aProof.d,
    g2a: inputs.msg2.g2b.point,
    g2aProofC: inputs.msg2.g2bProof.c,
    g2aProofD: inputs.msg2.g2bProof.d,
    g3a: inputs.msg2.g3b.point,
    g3aProofC: inputs.msg2.g3bProof.c,
    g3aProofD: inputs.msg2.g3bProof.d,
    pa: inputs.msg2.pb.point,
    qa: inputs.msg2.qb.point,
    paqaProofC: inputs.msg2.pbqbProof.c,
    paqaProofD0: inputs.msg2.pbqbProof.d0,
    paqaProofD1: inputs.msg2.pbqbProof.d1,
    ph: inputs.msg3.pa.point,
    qh: inputs.msg3.qa.point,
    phqhProofC: inputs.msg3.paqaProof.c,
    phqhProofD0: inputs.msg3.paqaProof.d0,
    phqhProofD1: inputs.msg3.paqaProof.d1,
    rh: inputs.msg3.ra.point,
    rhProofC: inputs.msg3.raProof.c,
    rhProofD: inputs.msg3.raProof.d
  });
  return args;
};

const verifyProofOfSMP = async (proof: TProof) => {
  return await verifyProof(proofOfSMPPath, proof);
};

const proofSuccessfulSMPInputsToCircuitArgs = (
  inputs: ProofSuccessfulSMPInput
) => {
  return stringifyBigInts({
    a3: inputs.a3,
    pa: inputs.pa.point,
    ph: inputs.ph.point,
    rh: inputs.rh.point,
    pubkeyA: inputs.pubkeyA,
    sigRhR8: inputs.sigRh.R8,
    sigRhS: inputs.sigRh.S
  });
};

const genProofSuccessfulSMP = async (
  inputs: ProofSuccessfulSMPInput,
) => {
  return await genProof(
    proofSuccessfulSMPPath,
    proofSuccessfulSMPInputsToCircuitArgs(inputs),
  );
};

const verifyProofSuccessfulSMP = async (proof: TProof) => {
  return await verifyProof(proofSuccessfulSMPPath, proof);
};

const genProofSaltedConnection = async (
  inputs: ProofSaltedConnectionInput,
) => {
  return await genProof(
    proofSaltedConnectionPath,
    proofSaltedConnectionInputToCircuitArgs(inputs),
  );
};

const proofSaltedConnectionInputToCircuitArgs = (inputs: ProofSaltedConnectionInput) => {
  const hubRegistry0Obj = inputs.creatorHubRegistry.toObj();
  const hubConnectionRegistryObj = inputs.hubConnectionRegistry.toSorted();
  return stringifyBigInts({
    creator: inputs.creator,
    hubPubkey0: hubConnectionRegistryObj.hubPubkey0,
    hubPubkey1: hubConnectionRegistryObj.hubPubkey1,
    creatorHubRegistryMerklePathElements: inputs.creatorHubRegistryMerkleProof.pathElements,
    creatorHubRegistryMerklePathIndices: inputs.creatorHubRegistryMerkleProof.indices,
    creatorHubRegistrySigR8: hubRegistry0Obj.sig.R8,
    creatorHubRegistrySigS: hubRegistry0Obj.sig.S,
    sigHubConnection0R8: hubConnectionRegistryObj.hubSig0.R8,
    sigHubConnection0S: hubConnectionRegistryObj.hubSig0.S,
    sigHubConnection1R8: hubConnectionRegistryObj.hubSig1.R8,
    sigHubConnection1S: hubConnectionRegistryObj.hubSig1.S,
    hubConnectionMerklePathElements: inputs.hubConnectionMerkleProof.pathElements,
    hubConnectionMerklePathIndices: inputs.hubConnectionMerkleProof.indices,
    adminAddress: inputs.adminAddress,
    hubRegistryTreeMerkleRoot: inputs.creatorHubRegistryMerkleProof.root,
    hubConnectionTreeMerkleRoot: inputs.hubConnectionMerkleProof.root,
    saltedHubPubkey0: saltPubkey(hubConnectionRegistryObj.hubPubkey0),
    saltedHubPubkey1: saltPubkey(hubConnectionRegistryObj.hubPubkey1),
  });
};

const verifyProofSaltedConnection = async (proof: TProof) => {
  return await verifyProof(proofSaltedConnectionPath, proof);
};

const getCircuitName = (circomFileBasename: string): string => {
  if (
    circomFileBasename.slice(circomFileBasename.length - circomFilePostfix.length) !==
    circomFilePostfix
  ) {
    throw new ValueError(
      `circom file must have postifx ${circomFilePostfix}: circomFile=${circomFileBasename}`
    );
  }
  return circomFileBasename.slice(0, circomFileBasename.length - circomFilePostfix.length);
};

/**
 * Find the circuit file under `circuits/`. Compile it and generate the proof with `inputs`.
 * @param circomFullPath
 * @param inputs
 * @param circuit
 */
const genProof = async (circomFullPath: string, inputs: any) => {
  const circomFileBasename = path.basename(circomFullPath);
  const circuitName = getCircuitName(circomFileBasename);
  const circuitR1csPath = `${circuitName}.r1cs`;
  const wasmPath = `${circuitName}.wasm`;
  const paramsPath = `${circuitName}.params`;
  return await genProofAndPublicSignals(
    inputs,
    circuitR1csPath,
    wasmPath,
    paramsPath,
  );
};

const genProofAndPublicSignals = async (
  inputs: any,
  circuitR1csFilename: string,
  circuitWasmFilename: string,
  paramsFilename: string,
) => {
  const paramsPath = path.join(buildDir, paramsFilename);
  const circuitR1csPath = path.join(buildDir, circuitR1csFilename);
  const circuitWasmPath = path.join(buildDir, circuitWasmFilename);
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const inputJsonPath = path.join(tmpDir.path, "input.json");
  const witnessPath = path.join(tmpDir.path, "witness.wtns");
  const witnessJsonPath = path.join(tmpDir.path, "witness.json");
  const proofPath = path.join(tmpDir.path, "proof.json");
  const publicJsonPath = path.join(tmpDir.path, "publicSignals.json");

  // TODO: should be changed to async later
  fs.writeFileSync(inputJsonPath, JSON.stringify(stringifyBigInts(inputs)));

  const snarkjsCmd = `node ${snarkjsCLI}`;
  const witnessCmd = `${snarkjsCmd} wc ${circuitWasmPath} ${inputJsonPath} ${witnessPath}`;

  shell.config.fatal = true;
  shell.exec(witnessCmd, { silent: true });

  const witnessJsonCmd = `${snarkjsCmd} wej ${witnessPath} ${witnessJsonPath}`;
  shell.exec(witnessJsonCmd, { silent: true });

  const proveCmd = `${zkutilPath} prove -c ${circuitR1csPath} -p ${paramsPath} -w ${witnessJsonPath} -r ${proofPath} -o ${publicJsonPath}`;

  shell.exec(proveCmd, { silent: true });

  // TODO: should be changed to async later
  const witness = unstringifyBigInts(
    JSON.parse(fs.readFileSync(witnessJsonPath).toString())
  );
  // TODO: should be changed to async later
  const publicSignals = unstringifyBigInts(
    JSON.parse(fs.readFileSync(publicJsonPath).toString())
  );
  // TODO: should be changed to async later
  const proof = JSON.parse(fs.readFileSync(proofPath).toString());

  await tmpDir.cleanup();
  return { proof, publicSignals, witness };
};

const verifyProof = async (circomFilePath: string, proof: TProof) => {
  const circuitName = getCircuitName(path.basename(circomFilePath));
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const paramsPath = path.join(buildDir, `${circuitName}.params`);
  const proofPath = path.join(tmpDir.path, 'proof.json');
  const publicSignalsPath = path.join(tmpDir.path, 'publicSignals.json');
  // TODO: can be combined to single command?
  fs.writeFileSync(
    proofPath,
    JSON.stringify(stringifyBigInts(proof.proof))
  );
  // TODO: can be combined to single command?
  fs.writeFileSync(
    publicSignalsPath,
    JSON.stringify(stringifyBigInts(proof.publicSignals))
  );
  const verifyCmd = `${zkutilPath} verify -p ${paramsPath} -r ${proofPath} -i ${publicSignalsPath}`;
  const output = shell.exec(verifyCmd, { silent: true }).stdout.trim();

  await tmpDir.cleanup();

  return output === "Proof is correct";
};

export const parseProofOfSMPPublicSignals = (publicSignals: BigInt[]) => {
  if (publicSignals.length !== 40) {
    throw new ValueError(
      `length of publicSignals is not correct: publicSignals=${publicSignals}`
    );
  }
  // Ignore the first `1n`.
  const pubkeyC = publicSignals.slice(1, 3);
  const adminAddress = publicSignals[3];
  const merkleRoot = publicSignals[4];
  const saltedPubkeyHub = publicSignals[5];
  const pa = new BabyJubPoint(publicSignals.slice(22, 24));
  const ph = new BabyJubPoint(publicSignals.slice(29, 31));
  const rh = new BabyJubPoint(publicSignals.slice(36, 38));
  return {
    pubkeyC,
    adminAddress,
    merkleRoot,
    pa,
    ph,
    rh,
    saltedPubkeyHub,
  };
};

const parseProofSuccessfulSMPPublicSignals = (publicSignals: BigInt[]) => {
  if (publicSignals.length !== 9) {
    throw new ValueError(
      `length of publicSignals is not correct: publicSignals=${publicSignals}`
    );
  }
  // Ignore the first `1n`.
  const pubkeyA = publicSignals.slice(1, 3);
  const pa = new BabyJubPoint(publicSignals.slice(3, 5));
  const ph = new BabyJubPoint(publicSignals.slice(5, 7));
  const rh = new BabyJubPoint(publicSignals.slice(7, 9));
  return {
    pubkeyA,
    pa,
    ph,
    rh
  };
};

export const parseProofSaltedConnectionPublicSignals = (publicSignals: BigInt[]) => {
  if (publicSignals.length !== 7) {
    throw new ValueError(
      `length of publicSignals is not correct: publicSignals=${publicSignals}`
    );
  }
  // Ignore the first `1n`.
  const creator = publicSignals[1];
  const adminAddress = publicSignals[2];
  const hubRegistryTreeMerkleRoot = publicSignals[3];
  const hubConnectionTreeMerkleRoot = publicSignals[4];
  const saltedHubPubkey0 = publicSignals[5];
  const saltedHubPubkey1 = publicSignals[6];

  let creatorSaltedPubkey: BigInt;
  let anotherSaltedPubkey: BigInt;
  if (creator === BigInt(0)) {
    creatorSaltedPubkey = saltedHubPubkey0;
    anotherSaltedPubkey = saltedHubPubkey1;
  } else if (creator === BigInt(1)) {
    creatorSaltedPubkey = saltedHubPubkey1;
    anotherSaltedPubkey = saltedHubPubkey0;
  } else {
    throw new ValueError(`\`creator\` should be either 0 or 1: creator=${creator}`);
  }

  return {
    creatorSaltedPubkey,
    anotherSaltedPubkey,
    adminAddress,
    hubRegistryTreeMerkleRoot,
    hubConnectionTreeMerkleRoot,
  };
};

const verifyProofIndirectConnection = async (
  proof: TProofIndirectConnection,
  validHubRegistryTreeRoots: Set<BigInt>,
  validHubConnectionRegistryTreeRoots: Set<BigInt>,
): Promise<boolean> => {
  if (!(await verifyProofOfSMP(proof.proofOfSMP))) {
    return false;
  }
  const resProofOfSMP = parseProofOfSMPPublicSignals(
    proof.proofOfSMP.publicSignals
  );
  if (!(await verifyProofSuccessfulSMP(proof.proofSuccessfulSMP))) {
    return false;
  }
  const resProofSuccessfulSMP = parseProofSuccessfulSMPPublicSignals(
    proof.proofSuccessfulSMP.publicSignals
  );

  /**
   * Check pubkeys in `proofOfSMP` and `proofSuccessfulSMP`.
   */
  if (!isPubkeySame(resProofSuccessfulSMP.pubkeyA, proof.pubkeyA)) {
    return false;
  }
  if (!isPubkeySame(resProofOfSMP.pubkeyC, proof.pubkeyC)) {
    return false;
  }
  if (resProofOfSMP.adminAddress !== proof.adminAddress) {
    return false;
  }
  /**
   * Check merkle root
   */
  if (!validHubRegistryTreeRoots.has(resProofOfSMP.merkleRoot)) {
    return false;
  }
  /**
   * Confirm the smp messages in `proofOfSMP` match the ones in `proofSuccessfulSMP`.
   */
  if (!resProofOfSMP.pa.equal(resProofSuccessfulSMP.pa)) {
    return false;
  }
  if (!resProofOfSMP.ph.equal(resProofSuccessfulSMP.ph)) {
    return false;
  }
  if (!resProofOfSMP.rh.equal(resProofSuccessfulSMP.rh)) {
    return false;
  }

  // successfuly SMP <> [salted conections] <> proof SMP
  /**
   * Verify Proof of Salted Connections
   */
  //  1. All proof of salted connections are valid.
  //  2. All proof of salted connections are chained together correctly, i.e. the last
  //     another is the current creator.
  const proofSaltedConnections = proof.proofSaltedConnections;
  let lastAnotherSaltedPubkey: BigInt | undefined = undefined;
  for (const p of proofSaltedConnections) {
    //  1. Verify Proof Salted Connection
    //  2. Parse the proof and extract salted pubkeys, and find the creator.
    if (!(await verifyProofSaltedConnection(p))) {
      return false;
    }
    const publicInputs = parseProofSaltedConnectionPublicSignals(p.publicSignals);
    if (publicInputs.adminAddress !== proof.adminAddress) {
      return false;
    }
    if (!validHubRegistryTreeRoots.has(publicInputs.hubRegistryTreeMerkleRoot)) {
      return false;
    }
    if (!validHubConnectionRegistryTreeRoots.has(publicInputs.hubConnectionTreeMerkleRoot)) {
      return false;
    }
    // <creator, another>
    // <A, B>, <B, C>
    //    creator = A, another = B
    //    this.creator === last.another
    if (
      lastAnotherSaltedPubkey !== undefined &&
      lastAnotherSaltedPubkey !== publicInputs.creatorSaltedPubkey
    ) {
      return false;
    }
    lastAnotherSaltedPubkey = publicInputs.anotherSaltedPubkey;
  }
  //  3. `anotherSaltedPubkey` of the another the last proof of salted connection is the
  //     creator of proof of SMP.
  if (proofSaltedConnections.length !== 0) {
    if (lastAnotherSaltedPubkey === undefined) {
      throw new Error(`lastAnotherSaltedPubkey must not be undefined here`);
    }
    if (lastAnotherSaltedPubkey !== resProofOfSMP.saltedPubkeyHub) {
      return false;
    }
  }

  return true;
};

export const saltPubkey = (pubkey: PubKey): BigInt => {
  return hash5([
    pubkey[0],
    pubkey[1],
    BigInt(0),
    BigInt(0),
    BigInt(0),
  ]);
}

export {
  genProofOfSMP,
  verifyProofOfSMP,
  proofOfSMPInputsToCircuitArgs,
  genProofSuccessfulSMP,
  genProofSaltedConnection,
  proofSaltedConnectionInputToCircuitArgs,
  proofSuccessfulSMPInputsToCircuitArgs,
  verifyProofSuccessfulSMP,
  verifyProofSaltedConnection,
  verifyProofIndirectConnection,
  TProof,
  TProofIndirectConnection
};
