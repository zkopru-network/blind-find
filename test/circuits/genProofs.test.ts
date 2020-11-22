import { stringifyBigInts } from "maci-crypto";
import { genProof, verifyProof } from "../../src/circuits/ts";


describe('Test `genProof` and `verifyProof`', () => {
    test('t.circom', async () => {

        const args = stringifyBigInts({
            a: "3",
            b: "7",
            c: "21",
          });
          const circuitName = 'instance/t.circom';
          const { proof, publicSignals, witness, circuit } = await genProof(circuitName, args);
          const res = await verifyProof(circuitName, proof, publicSignals);
          console.log(res);
    });
});
