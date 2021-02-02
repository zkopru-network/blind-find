import * as path from "path";
import { compileAndLoadCircuit } from "../../src/circuits";

const circomFilesDir = path.join(__dirname, "circom");

export const compileCircuit = async (circomFileName: string) => {
  const filePath = path.join(circomFilesDir, circomFileName);
  return await compileAndLoadCircuit(filePath);
};
