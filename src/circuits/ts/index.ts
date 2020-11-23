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
const circom = require("circom");

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
  msg1: SMPMessage1Wire;
  msg2: SMPMessage2Wire;
  msg3: SMPMessage3Wire;
  root: BigInt;
  proof: any; // FIXME: use any because this interface is not exposed by maci-crypto.
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
};

const genProofOfSMP = async (inputs: ProofOfSMPInput) => {
  const args = proofOfSMPInputsToCircuitArgs(inputs);
  return await genProof(proofOfSMPPath, args);
};

const proofOfSMPInputsToCircuitArgs = (inputs: ProofOfSMPInput) => {
  if (!inputs.hubRegistry.verify()) {
    throw new ValueError("registry is invalid");
  }
  if (
    inputs.hubRegistry.adminPubkey === undefined ||
    inputs.hubRegistry.adminSig === undefined
  ) {
    throw new ValueError(
      `registry is not counter-signed: hubRegistry=${inputs.hubRegistry}`
    );
  }
  const args = stringifyBigInts({
    merklePathElements: inputs.proof.pathElements,
    merklePathIndices: inputs.proof.indices,
    merkleRoot: inputs.root,
    sigHubRegistryR8: [
      inputs.hubRegistry.sig.R8[0].toString(),
      inputs.hubRegistry.sig.R8[1].toString()
    ],
    sigHubRegistryS: inputs.hubRegistry.sig.S.toString(),
    sigAdminR8: [
      inputs.hubRegistry.adminSig.R8[0].toString(),
      inputs.hubRegistry.adminSig.R8[1].toString()
    ],
    sigAdminS: inputs.hubRegistry.adminSig.S.toString(),
    pubkeyAdmin: [
      inputs.hubRegistry.adminPubkey[0].toString(),
      inputs.hubRegistry.adminPubkey[1].toString()
    ],
    pubkeyC: [inputs.pubkeyC[0].toString(), inputs.pubkeyC[1].toString()],
    sigCR8: [
      inputs.sigJoinMsgC.R8[0].toString(),
      inputs.sigJoinMsgC.R8[1].toString()
    ],
    sigCS: inputs.sigJoinMsgC.S.toString(),
    pubkeyHub: [inputs.pubkeyHub[0].toString(), inputs.pubkeyHub[1].toString()],
    sigJoinMsgHubR8: [
      inputs.sigJoinMsgHub.R8[0].toString(),
      inputs.sigJoinMsgHub.R8[1].toString()
    ],
    sigJoinMsgHubS: inputs.sigJoinMsgHub.S.toString(),
    h2: inputs.h2.toString(),
    h3: inputs.h3.toString(),
    g2h: [
      inputs.msg1.g2a.point[0].toString(),
      inputs.msg1.g2a.point[1].toString()
    ],
    g2hProofC: inputs.msg1.g2aProof.c.toString(),
    g2hProofD: inputs.msg1.g2aProof.d.toString(),
    g3h: [
      inputs.msg1.g3a.point[0].toString(),
      inputs.msg1.g3a.point[1].toString()
    ],
    g3hProofC: inputs.msg1.g3aProof.c.toString(),
    g3hProofD: inputs.msg1.g3aProof.d.toString(),
    g2a: [
      inputs.msg2.g2b.point[0].toString(),
      inputs.msg2.g2b.point[1].toString()
    ],
    g2aProofC: inputs.msg2.g2bProof.c.toString(),
    g2aProofD: inputs.msg2.g2bProof.d.toString(),
    g3a: [
      inputs.msg2.g3b.point[0].toString(),
      inputs.msg2.g3b.point[1].toString()
    ],
    g3aProofC: inputs.msg2.g3bProof.c.toString(),
    g3aProofD: inputs.msg2.g3bProof.d.toString(),
    pa: [
      inputs.msg2.pb.point[0].toString(),
      inputs.msg2.pb.point[1].toString()
    ],
    qa: [
      inputs.msg2.qb.point[0].toString(),
      inputs.msg2.qb.point[1].toString()
    ],
    paqaProofC: inputs.msg2.pbqbProof.c.toString(),
    paqaProofD0: inputs.msg2.pbqbProof.d0.toString(),
    paqaProofD1: inputs.msg2.pbqbProof.d1.toString(),
    ph: [
      inputs.msg3.pa.point[0].toString(),
      inputs.msg3.pa.point[1].toString()
    ],
    qh: [
      inputs.msg3.qa.point[0].toString(),
      inputs.msg3.qa.point[1].toString()
    ],
    phqhProofC: inputs.msg3.paqaProof.c.toString(),
    phqhProofD0: inputs.msg3.paqaProof.d0.toString(),
    phqhProofD1: inputs.msg3.paqaProof.d1.toString(),
    rh: [
      inputs.msg3.ra.point[0].toString(),
      inputs.msg3.ra.point[1].toString()
    ],
    rhProofC: inputs.msg3.raProof.c.toString(),
    rhProofD: inputs.msg3.raProof.d.toString()
  });
  return args;
};

const verifyProofOfSMP = async (proof: any, publicSignals: any) => {
  return await verifyProof(proofOfSMPPath, proof, publicSignals);
};

const proofSuccessfulSMPInputsToCircuitArgs = (
  inputs: ProofSuccessfulSMPInput
) => {
  return stringifyBigInts({
    a3: inputs.a3.toString(),
    pa: [inputs.pa.point[0].toString(), inputs.pa.point[1].toString()],
    ph: [inputs.ph.point[0].toString(), inputs.ph.point[1].toString()],
    rh: [inputs.rh.point[0].toString(), inputs.rh.point[1].toString()]
  });
};

const genProofSuccessfulSMP = async (inputs: ProofSuccessfulSMPInput) => {
  return await genProof(
    proofSuccessfulSMPPath,
    proofSuccessfulSMPInputsToCircuitArgs(inputs)
  );
};

const verifyProofSuccessfulSMP = async (proof: any, publicSignals: any) => {
  return await verifyProof(proofSuccessfulSMPPath, proof, publicSignals);
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
const genProof = (circomFile: string, inputs: any, circuit?: any) => {
  const circuitName = getCircuitName(circomFile);
  const circomFullPath = path.join(circomDir, circomFile);
  const circuitR1csPath = `${circuitName}.r1cs`;
  const wasmPath = `${circuitName}.wasm`;
  const paramsPath = `${circuitName}.params`;
  return genProofAndPublicSignals(
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
  const inputJsonPath = path.join(buildDir, date + ".input.json");
  const witnessPath = path.join(buildDir, date + ".witness.wtns");
  const witnessJsonPath = path.join(buildDir, date + ".witness.json");
  const proofPath = path.join(buildDir, date + ".proof.json");
  const publicJsonPath = path.join(buildDir, date + ".publicSignals.json");

  fs.writeFileSync(inputJsonPath, JSON.stringify(stringifyBigInts(inputs)));

  if (!circuit) {
    circuit = await compileAndLoadCircuit(circuitFilename);
  }

  const snarkjsCmd = `node ${snarkjsCLI}`;
  const witnessCmd = `${snarkjsCmd} wc ${circuitWasmPath} ${inputJsonPath} ${witnessPath}`;

  shell.config.fatal = true;
  console.log(`witnessCmd="${witnessCmd}"`);
  shell.exec(witnessCmd);

  const witnessJsonCmd = `${snarkjsCmd} wej ${witnessPath} ${witnessJsonPath}`;
  shell.exec(witnessJsonCmd);

  const proveCmd = `${zkutilPath} prove -c ${circuitR1csPath} -p ${paramsPath} -w ${witnessJsonPath} -r ${proofPath} -o ${publicJsonPath}`;

  shell.exec(proveCmd);

  const witness = unstringifyBigInts(
    JSON.parse(fs.readFileSync(witnessJsonPath).toString())
  );
  const publicSignals = unstringifyBigInts(
    JSON.parse(fs.readFileSync(publicJsonPath).toString())
  );
  const proof = JSON.parse(fs.readFileSync(proofPath).toString());

  await circuit.checkConstraints(witness);

  shell.rm("-f", witnessPath);
  shell.rm("-f", witnessJsonPath);
  shell.rm("-f", proofPath);
  shell.rm("-f", publicJsonPath);
  shell.rm("-f", inputJsonPath);

  return { proof, publicSignals, witness, circuit };
};

const verifyProof = (circomFile: string, proof: any, publicSignals: any) => {
  const date = Date.now().toString();
  const circuitName = getCircuitName(circomFile);
  const paramsFilename = `${circuitName}.params`;
  const proofFilename = `${date}.${circuitName}.proof.json`;
  const publicSignalsFilename = `${date}.${circuitName}.publicSignals.json`;
  fs.writeFileSync(
    path.join(buildDir, proofFilename),
    JSON.stringify(stringifyBigInts(proof))
  );
  fs.writeFileSync(
    path.join(buildDir, publicSignalsFilename),
    JSON.stringify(stringifyBigInts(publicSignals))
  );

  return verifyProofInFiles(
    paramsFilename,
    proofFilename,
    publicSignalsFilename
  );
};

const verifyProofInFiles = async (
  paramsFilename: string,
  proofFilename: string,
  publicSignalsFilename: string
): Promise<boolean> => {
  const paramsPath = path.join(buildDir, paramsFilename);
  const proofPath = path.join(buildDir, proofFilename);
  const publicSignalsPath = path.join(buildDir, publicSignalsFilename);
  const verifyCmd = `${zkutilPath} verify -p ${paramsPath} -r ${proofPath} -i ${publicSignalsPath}`;
  console.log(`verifyCmd = "${verifyCmd}"`);
  const output = shell.exec(verifyCmd).stdout.trim();

  shell.rm("-f", proofPath);
  shell.rm("-f", publicSignalsPath);

  return output === "Proof is correct";
};

type Proof = { proof: any; publicSignals: any };

const parseProofOfSMPPublicSignals = (publicSignals: BigInt[]) => {
  if (publicSignals.length !== 40) {
    throw new ValueError(
      `length of publicSignals is not correct: publicSignals=${publicSignals}`
    );
  }
  const pubkeyC = publicSignals.slice(1, 3);
  const pubkeyAdmin = publicSignals.slice(3, 5);
  const merkleRoot = publicSignals[5];
  const pa = new BabyJubPoint(publicSignals.slice(22, 24));
  const ph = new BabyJubPoint(publicSignals.slice(29, 31));
  const rh = new BabyJubPoint(publicSignals.slice(36, 38));
  return {
    pubkeyC,
    pubkeyAdmin,
    merkleRoot,
    pa,
    ph,
    rh
  };
};

const parseProofSuccessfulSMPPublicSignals = (publicSignals: BigInt[]) => {
  if (publicSignals.length !== 7) {
    throw new ValueError(
      `length of publicSignals is not correct: publicSignals=${publicSignals}`
    );
  }
  // Ignore the first `1n`.
  const pa = new BabyJubPoint(publicSignals.slice(1, 3));
  const ph = new BabyJubPoint(publicSignals.slice(3, 5));
  const rh = new BabyJubPoint(publicSignals.slice(5, 7));
  return {
    pa,
    ph,
    rh
  };
};

const verifyProofIndirectConnection = async (
  proofOfSMP: Proof,
  proofSuccessfulSMP: Proof
) => {
  if (!(await verifyProofOfSMP(proofOfSMP.proof, proofOfSMP.publicSignals))) {
    return false;
  }
  const resProofOfSMP = parseProofOfSMPPublicSignals(proofOfSMP.publicSignals);
  if (
    !(await verifyProofSuccessfulSMP(
      proofSuccessfulSMP.proof,
      proofSuccessfulSMP.publicSignals
    ))
  ) {
    return false;
  }
  const resProofSuccessfulSMP = parseProofSuccessfulSMPPublicSignals(
    proofSuccessfulSMP.publicSignals
  );
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
  genProof,
  verifyProof,
  genProofOfSMP,
  verifyProofOfSMP,
  proofOfSMPInputsToCircuitArgs,
  genProofSuccessfulSMP,
  proofSuccessfulSMPInputsToCircuitArgs,
  verifyProofSuccessfulSMP,
  verifyProofIndirectConnection,
  ProofOfSMPInput,
  Proof
};
