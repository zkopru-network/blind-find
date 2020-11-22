import * as fs from 'fs';
import * as path from 'path';
const circom = require('circom');
import * as shell from 'shelljs';

import {
    stringifyBigInts,
    unstringifyBigInts,
} from 'maci-crypto';
import { ValueError } from '../../smp/exceptions';

const zkutilPath = "~/.cargo/bin/zkutil";

export const compileAndLoadCircuit = async (circuitPath: string) => {
  const circuit = await circom.tester(path.join(circuitPath));

  await circuit.loadSymbols();

  return circuit;
};

const circomFilePostfix = ".circom";
const circomDir = `${__dirname}/../circom`;
const buildDir = `${__dirname}/../../../build`;
const snarkjsCLI = path.join(__dirname, '../../../node_modules/snarkjs/build/cli.cjs');
const proofOfSMPCircom = 'proofOfSMP';
const proofSuccessfulSMPCircom = 'proofSuccessfulSMP';


const getCircuitName = (circomFile: string): string => {
  if (circomFile.slice(circomFile.length - circomFilePostfix.length) !== circomFilePostfix) {
    throw new ValueError(`circom file must have postifx ${circomFilePostfix}: circomFile=${circomFile}`);
  }
  const basename = circomFile.substring(circomFile.lastIndexOf('/') + 1);
  return basename.slice(0, basename.length - circomFilePostfix.length);
}

/**
 * Find the circuit file under `src/circuits/circom/`. Compile it and generate the proof with `inputs`.
 * @param circomFile
 * @param inputs
 * @param circuit
 */
const genProof = (
  circomFile: string,
  inputs: any,
  circuit?: any,
) => {
  const circuitName = getCircuitName(circomFile);
  const circomFullPath = path.join(circomDir, circomFile);
  const circuitR1csPath = `${circuitName}.r1cs`;
  const wasmPath  = `${circuitName}.wasm`;
  const paramsPath  = `${circuitName}.params`;
  return genProofAndPublicSignals(
      inputs,
      circomFullPath,
      circuitR1csPath,
      wasmPath,
      paramsPath,
      circuit,
  )
}

const genProofAndPublicSignals = async (
  inputs: any,
  circuitFilename: string,
  circuitR1csFilename: string,
  circuitWasmFilename: string,
  paramsFilename: string,
  circuit?: any,
) => {
  const date = Date.now();
  const paramsPath = path.join(buildDir, paramsFilename);
  const circuitR1csPath = path.join(buildDir, circuitR1csFilename);
  const circuitWasmPath = path.join(buildDir, circuitWasmFilename);
  const inputJsonPath = path.join(buildDir, date + '.input.json');
  const witnessPath = path.join(buildDir, date + '.witness.wtns');
  const witnessJsonPath = path.join(buildDir, date + '.witness.json');
  const proofPath = path.join(buildDir, date + '.proof.json');
  const publicJsonPath = path.join(buildDir, date + '.publicSignals.json');

  fs.writeFileSync(inputJsonPath, JSON.stringify(stringifyBigInts(inputs)));

  if (!circuit) {
      circuit = await compileAndLoadCircuit(circuitFilename);
  }

  const snarkjsCmd = `node ${snarkjsCLI}`;
  const witnessCmd = `${snarkjsCmd} wc ${circuitWasmPath} ${inputJsonPath} ${witnessPath}`;

  shell.config.fatal = true
  console.log(`witnessCmd="${witnessCmd}"`);
  shell.exec(witnessCmd)

  const witnessJsonCmd = `${snarkjsCmd} wej ${witnessPath} ${witnessJsonPath}`
  shell.exec(witnessJsonCmd)

  const proveCmd = `${zkutilPath} prove -c ${circuitR1csPath} -p ${paramsPath} -w ${witnessJsonPath} -r ${proofPath} -o ${publicJsonPath}`

  shell.exec(proveCmd)

  const witness = unstringifyBigInts(JSON.parse(fs.readFileSync(witnessJsonPath).toString()))
  const publicSignals = unstringifyBigInts(JSON.parse(fs.readFileSync(publicJsonPath).toString()))
  const proof = JSON.parse(fs.readFileSync(proofPath).toString())

  await circuit.checkConstraints(witness)

  shell.rm('-f', witnessPath)
  shell.rm('-f', witnessJsonPath)
  shell.rm('-f', proofPath)
  shell.rm('-f', publicJsonPath)
  shell.rm('-f', inputJsonPath)

  return { proof, publicSignals, witness, circuit }
}


const verifyProof = (
  circomFile: string,
  proof: any,
  publicSignals: any,
) => {
  const date = Date.now().toString();
  const circuitName = getCircuitName(circomFile);
  const paramsFilename = `${circuitName}.params`;
  const proofFilename = `${date}.${circuitName}.proof.json`;
  const publicSignalsFilename = `${date}.${circuitName}.publicSignals.json`;
  fs.writeFileSync(
      path.join(buildDir, proofFilename),
      JSON.stringify(
          stringifyBigInts(proof)
      )
  )
  fs.writeFileSync(
      path.join(buildDir, publicSignalsFilename),
      JSON.stringify(
          stringifyBigInts(publicSignals)
      )
  )

  return verifyProofInFiles(paramsFilename, proofFilename, publicSignalsFilename)
}

const verifyProofInFiles = async (
  paramsFilename: string,
  proofFilename: string,
  publicSignalsFilename: string,
): Promise<boolean> => {
  const paramsPath = path.join(buildDir, paramsFilename)
  const proofPath = path.join(buildDir, proofFilename)
  const publicSignalsPath = path.join(buildDir, publicSignalsFilename)
  const verifyCmd = `${zkutilPath} verify -p ${paramsPath} -r ${proofPath} -i ${publicSignalsPath}`
  console.log(`verifyCmd = "${verifyCmd}"`);
  const output = shell.exec(verifyCmd).stdout.trim()

  shell.rm('-f', proofPath)
  shell.rm('-f', publicSignalsPath)

  return output === 'Proof is correct'
}

export { genProof, verifyProof };
