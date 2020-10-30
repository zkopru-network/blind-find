jest.setTimeout(90000)
import * as path from "path";

import {
    stringifyBigInts,
    genRandomSalt,
    sign,
    hash5,
} from 'maci-crypto'
import { executeCircuit, getSignalByName } from "maci-circuits";

import { smpHash } from "../../src/smp/v4/hash";
import { compileAndLoadCircuit } from "../../src/circuits/ts";
import { verifySignature } from "maci-crypto";
import { genPubKey } from "maci-crypto";


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

describe('babyJub signature', () => {
    test('result from circuit is the same as the output calculated outside', async () => {
        const privkey = genRandomSalt();
        const pubkey = genPubKey(privkey);
        const data = hash5([genRandomSalt(), genRandomSalt(), genRandomSalt(), genRandomSalt(), genRandomSalt()]);
        const sig = sign(privkey, data);
        expect(verifySignature(data, sig, pubkey)).toBeTruthy();

        const circuit = await compileCircuit('verifySignature.circom');
        const circuitInputs = stringifyBigInts({
            'Ax': stringifyBigInts(pubkey[0]),
            'Ay': stringifyBigInts(pubkey[1]),
            'R8x': stringifyBigInts(sig.R8[0]),
            'R8y': stringifyBigInts(sig.R8[1]),
            'S': stringifyBigInts(sig.S),
            'M': stringifyBigInts(data),
        });
        const witness = await executeCircuit(circuit, circuitInputs);
        const isValid = getSignalByName(circuit, witness, 'main.valid').toString();
        expect(isValid).toEqual('1');
    });
});

