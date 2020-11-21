import * as fs from 'fs';
import * as path from 'path';
const circom = require('circom');
import * as shell from 'shelljs';

import {
    stringifyBigInts,
    unstringifyBigInts,
} from 'maci-crypto';

const zkutilPath = "~/.cargo/bin/zkutil";

export const compileAndLoadCircuit = async (circuitPath: string) => {
  const circuit = await circom.tester(path.join(circuitPath));

  await circuit.loadSymbols();

  return circuit;
};

// TODO:
//  - Create/Verify Proof SMP
//  - Create/Verify Proof Successful SMP
//  - Create/Verify Proof Indirection connections

const buildDir = `${__dirname}/../../../build`;
const snarkjsCLI = path.join(__dirname, '../../../node_modules/snarkjs/build/cli.cjs');


const genQvtProofAndPublicSignals = (
  inputs: any,
  circuit?: any,
) => {

  const circuitName = 't';
  const circuitPath = `${circuitName}.circom`;
  const circuitR1csPath = `${circuitName}.r1cs`;
  const wasmPath  = `${circuitName}.wasm`;
  const paramsPath  = `${circuitName}.params`;
  return genProofAndPublicSignals(
      inputs,
      circuitPath,
      circuitR1csPath,
      wasmPath,
      paramsPath,
      circuit,
  )
}

export const genProofAndPublicSignals = async (
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


export const verifyQvtProof = (
  proof: any,
  publicSignals: any,
) => {
  const date = Date.now().toString()
  const circuitName = 't';
  const paramsFilename = `${circuitName}.params`;
  const proofFilename = `${date}.${circuitName}.proof.json`;
  const publicSignalsFilename = `${date}.${circuitName}.publicSignals.json`;
  console.log('1');
  // TODO: refactor
  fs.writeFileSync(
      path.join(buildDir, proofFilename),
      JSON.stringify(
          stringifyBigInts(proof)
      )
  )
  console.log('2');
  fs.writeFileSync(
      path.join(buildDir, publicSignalsFilename),
      JSON.stringify(
          stringifyBigInts(publicSignals)
      )
  )
  console.log('3');

  return verifyProof(paramsFilename, proofFilename, publicSignalsFilename)
}

export const verifyProof = async (
  paramsFilename: string,
  proofFilename: string,
  publicSignalsFilename: string,
): Promise<boolean> => {
  const paramsPath = path.join(buildDir, paramsFilename)
  const proofPath = path.join(buildDir, proofFilename)
  const publicSignalsPath = path.join(buildDir, publicSignalsFilename)
  console.log('4');
  const verifyCmd = `${zkutilPath} verify -p ${paramsPath} -r ${proofPath} -i ${publicSignalsPath}`
  console.log(`verifyCmd = "${verifyCmd}"`);
  const output = shell.exec(verifyCmd).stdout.trim()

  console.log('6');
  shell.rm('-f', proofPath)
  shell.rm('-f', publicSignalsPath)

  return output === 'Proof is correct'
}

const main = async () => {
  const args = stringifyBigInts({
    a: "3",
    b: "7",
    c: "21",
  });
  const { proof, publicSignals, witness, circuit } = await genQvtProofAndPublicSignals(args);
  const res = await verifyQvtProof(proof, publicSignals);
  console.log(res);
}

main();
