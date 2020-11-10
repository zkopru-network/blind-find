import * as path from "path";

const circom = require("circom");

export const compileAndLoadCircuit = async (circuitPath: string) => {
  const circuit = await circom.tester(path.join(circuitPath));

  await circuit.loadSymbols();

  return circuit;
};


// TODO:
//  - Create/Verify Proof SMP
//  - Create/Verify Proof Successful SMP
//  - Create/Verify Proof Indirection connections
