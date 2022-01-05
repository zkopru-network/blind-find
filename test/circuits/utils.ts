import * as path from "path";
const circom = require("circom");
const circomFilesDir = path.join(__dirname, "circom");

export const compileCircuit = async (circomFileName: string) => {
  const circuitPath = path.join(circomFilesDir, circomFileName);
  const circuit = await circom.tester(path.join(circuitPath));
  await circuit.loadSymbols();
  return circuit;
};
