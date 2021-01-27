import * as fs from "fs";
import * as path from "path";
import * as shell from "shelljs";

import {
  PubKey,
  Signature,
  stringifyBigInts,
  unstringifyBigInts
} from "maci-crypto";
import { ValueError } from "../../smp/exceptions";
import {
  SMPMessage1Wire,
  SMPMessage2Wire,
  SMPMessage3Wire
} from "../../smp/v4/serialization";
import { HubRegistry } from "../..";
import { BabyJubPoint } from "../../smp/v4/babyJub";
import { MerkleProof } from "../../interfaces";
import { TEthereumAddress } from "../../types";
const circom = require("circom");

/**
 * Ref
 *  - maci-circuit: https://github.com/appliedzkp/maci/blob/e5e3c2f9f5f0d6b130b1c4b0ee41e6042c0cbcc0/circuits/ts/index.ts#L161
 */

const zkutilPath = "~/.cargo/bin/zkutil";

export const compileAndLoadCircuit = async (circuitPath: string) => {
  const circuit = await circom.tester(path.join(circuitPath));

  await circuit.loadSymbols();

  return circuit;
};

const circomFilePostfix = ".circom";
const circomDir = `${__dirname}/../circom`;
const buildDir = `${__dirname}/../../../build`;
const snarkjsCLI = path.join(
  __dirname,
  "../../../node_modules/snarkjs/build/cli.cjs"
);
const proofOfSMPPath = "instance/proofOfSMP.circom";
const proofSuccessfulSMPPath = "instance/proofSuccessfulSMP.circom";

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

type TProof = { proof: any; publicSignals: any };
type TProofIndirectConnection = {
  pubkeyA: PubKey;
  pubkeyC: PubKey;
  adminAddress: TEthereumAddress;
  proofOfSMP: TProof;
  proofSuccessfulSMP: TProof;
};

const genProofOfSMP = async (inputs: ProofOfSMPInput, circuit?: any) => {
  const args = proofOfSMPInputsToCircuitArgs(inputs);
  return await genProof(proofOfSMPPath, args, circuit);
};

const proofOfSMPInputsToCircuitArgs = (inputs: ProofOfSMPInput) => {
  if (!inputs.hubRegistry.verify()) {
    throw new ValueError("registry is invalid");
  }
  const args = stringifyBigInts({
    merklePathElements: inputs.proof.pathElements,
    merklePathIndices: inputs.proof.indices,
    merkleRoot: inputs.proof.root,
    sigHubRegistryR8: inputs.hubRegistry.sig.R8,
    sigHubRegistryS: inputs.hubRegistry.sig.S,
    adminAddress: inputs.hubRegistry.adminAddress,
    pubkeyC: inputs.pubkeyC,
    sigCR8: inputs.sigJoinMsgC.R8,
    sigCS: inputs.sigJoinMsgC.S,
    pubkeyHub: inputs.pubkeyHub,
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

const verifyProofOfSMP = (proof: TProof) => {
  return verifyProof(proofOfSMPPath, proof);
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
  circuit?: any
) => {
  return await genProof(
    proofSuccessfulSMPPath,
    proofSuccessfulSMPInputsToCircuitArgs(inputs),
    circuit
  );
};

const verifyProofSuccessfulSMP = (proof: TProof) => {
  return verifyProof(proofSuccessfulSMPPath, proof);
};

const getCircuitName = (circomFile: string): string => {
  if (
    circomFile.slice(circomFile.length - circomFilePostfix.length) !==
    circomFilePostfix
  ) {
    throw new ValueError(
      `circom file must have postifx ${circomFilePostfix}: circomFile=${circomFile}`
    );
  }
  const basename = circomFile.substring(circomFile.lastIndexOf("/") + 1);
  return basename.slice(0, basename.length - circomFilePostfix.length);
};

/**
 * Find the circuit file under `src/circuits/circom/`. Compile it and generate the proof with `inputs`.
 * @param circomFile
 * @param inputs
 * @param circuit
 */
const genProof = async (circomFile: string, inputs: any, circuit?: any) => {
  const circuitName = getCircuitName(circomFile);
  const circomFullPath = path.join(circomDir, circomFile);
  const circuitR1csPath = `${circuitName}.r1cs`;
  const wasmPath = `${circuitName}.wasm`;
  const paramsPath = `${circuitName}.params`;
  return await genProofAndPublicSignals(
    inputs,
    circomFullPath,
    circuitR1csPath,
    wasmPath,
    paramsPath,
    circuit
  );
};

const genProofAndPublicSignals = async (
  inputs: any,
  circuitFilename: string,
  circuitR1csFilename: string,
  circuitWasmFilename: string,
  paramsFilename: string,
  circuit?: any
) => {
  const date = Date.now();
  const paramsPath = path.join(buildDir, paramsFilename);
  const circuitR1csPath = path.join(buildDir, circuitR1csFilename);
  const circuitWasmPath = path.join(buildDir, circuitWasmFilename);
  const pathPrefix = path.join(buildDir, date.toString());
  const inputJsonPath = `${pathPrefix}.input.json`;
  const witnessPath = `${pathPrefix}.witness.wtns`;
  const witnessJsonPath = `${pathPrefix}.witness.json`;
  const proofPath = `${pathPrefix}.proof.json`;
  const publicJsonPath = `${pathPrefix}.publicSignals.json`;

  // TODO: should be changed to async later
  fs.writeFileSync(inputJsonPath, JSON.stringify(stringifyBigInts(inputs)));

  if (!circuit) {
    circuit = await compileAndLoadCircuit(circuitFilename);
  }

  const snarkjsCmd = `node ${snarkjsCLI}`;
  const witnessCmd = `${snarkjsCmd} wc ${circuitWasmPath} ${inputJsonPath} ${witnessPath}`;

  shell.config.fatal = true;
  console.debug(`witnessCmd="${witnessCmd}"`);
  shell.exec(witnessCmd);

  const witnessJsonCmd = `${snarkjsCmd} wej ${witnessPath} ${witnessJsonPath}`;
  shell.exec(witnessJsonCmd);

  const proveCmd = `${zkutilPath} prove -c ${circuitR1csPath} -p ${paramsPath} -w ${witnessJsonPath} -r ${proofPath} -o ${publicJsonPath}`;

  shell.exec(proveCmd);

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
  await circuit.checkConstraints(witness);

  // TODO: can be combined to single command?
  // TODO: `shell` can be changed to async
  shell.rm("-f", witnessPath);
  shell.rm("-f", witnessJsonPath);
  shell.rm("-f", proofPath);
  shell.rm("-f", publicJsonPath);
  shell.rm("-f", inputJsonPath);

  return { proof, publicSignals, witness, circuit };
};

const verifyProof = (circomFile: string, proof: TProof) => {
  const date = Date.now().toString();
  const circuitName = getCircuitName(circomFile);
  const paramsFilename = `${circuitName}.params`;
  const proofFilename = `${date}.${circuitName}.proof.json`;
  const publicSignalsFilename = `${date}.${circuitName}.publicSignals.json`;
  // TODO: can be combined to single command?
  fs.writeFileSync(
    path.join(buildDir, proofFilename),
    JSON.stringify(stringifyBigInts(proof.proof))
  );
  // TODO: can be combined to single command?
  fs.writeFileSync(
    path.join(buildDir, publicSignalsFilename),
    JSON.stringify(stringifyBigInts(proof.publicSignals))
  );

  return verifyProofInFiles(
    paramsFilename,
    proofFilename,
    publicSignalsFilename
  );
};

const verifyProofInFiles = (
  paramsFilename: string,
  proofFilename: string,
  publicSignalsFilename: string
): boolean => {
  const paramsPath = path.join(buildDir, paramsFilename);
  const proofPath = path.join(buildDir, proofFilename);
  const publicSignalsPath = path.join(buildDir, publicSignalsFilename);
  const verifyCmd = `${zkutilPath} verify -p ${paramsPath} -r ${proofPath} -i ${publicSignalsPath}`;
  const output = shell.exec(verifyCmd).stdout.trim();

  // TODO: can be combined to single command?
  shell.rm("-f", proofPath);
  shell.rm("-f", publicSignalsPath);

  return output === "Proof is correct";
};

const parseProofOfSMPPublicSignals = (publicSignals: BigInt[]) => {
  if (publicSignals.length !== 39) {
    throw new ValueError(
      `length of publicSignals is not correct: publicSignals=${publicSignals}`
    );
  }
  // Ignore the first `1n`.
  const pubkeyC = publicSignals.slice(1, 3);
  const adminAddress = publicSignals[3];
  const merkleRoot = publicSignals[4];
  const pa = new BabyJubPoint(publicSignals.slice(21, 23));
  const ph = new BabyJubPoint(publicSignals.slice(28, 30));
  const rh = new BabyJubPoint(publicSignals.slice(35, 37));
  return {
    pubkeyC,
    adminAddress,
    merkleRoot,
    pa,
    ph,
    rh
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

const isPubkeySame = (a: PubKey, b: PubKey) => {
  return a.length === b.length && a[0] === b[0] && a[1] === b[1];
};

const verifyProofIndirectConnection = (
  proof: TProofIndirectConnection,
  validMerkleRoots: Set<BigInt>
) => {
  if (!verifyProofOfSMP(proof.proofOfSMP)) {
    return false;
  }
  const resProofOfSMP = parseProofOfSMPPublicSignals(
    proof.proofOfSMP.publicSignals
  );
  if (!verifyProofSuccessfulSMP(proof.proofSuccessfulSMP)) {
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
  if (!validMerkleRoots.has(resProofOfSMP.merkleRoot)) {
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
  return true;
};

export {
  genProofOfSMP,
  verifyProofOfSMP,
  proofOfSMPInputsToCircuitArgs,
  genProofSuccessfulSMP,
  proofSuccessfulSMPInputsToCircuitArgs,
  verifyProofSuccessfulSMP,
  verifyProofIndirectConnection,
  TProof,
  TProofIndirectConnection
};
