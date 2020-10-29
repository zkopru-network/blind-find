jest.setTimeout(90000)
import * as path from "path";

import {
    stringifyBigInts,
    genRandomSalt,
} from 'maci-crypto'
import { executeCircuit, getSignalByName } from "maci-circuits";

import { smpHash } from "../../src/smp/v4/hash";
import { compileAndLoadCircuit } from "../../src/circuits/ts";


const circomFilesDir = path.join(
    __dirname,
    'circom'
)

const compileCircuit = async (circomFileName: string) => {
    const filePath = path.join(circomFilesDir, circomFileName);
    return await compileAndLoadCircuit(filePath);
}

describe('smpHash', () => {
    const version = 1;

    test('result from circuit is correct', async () => {
        const args = [genRandomSalt(), genRandomSalt()];
        const resJs = smpHash(version, ...args);

        const actualPreImages = [BigInt(version), ...args, BigInt(0), BigInt(0)];  // Padded with 0 to 5.
        const circuit = await compileCircuit('hasher5Test.circom');
        const circuitInputs = stringifyBigInts({
            in: actualPreImages,
        })
        const witness = await executeCircuit(circuit, circuitInputs);
        const output = getSignalByName(circuit, witness, 'main.hash');
        expect(output.toString()).toEqual(resJs.toString());
    });
});

describe.only('babyJub signature', () => {
    test('result from circuit is the same as the output calculated outside', () => {
        const privkey = genRandomSalt();
    });
});

