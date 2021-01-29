import { Command } from "commander";
import { genKeypair, stringifyBigInts } from "maci-crypto";

export const buildCommandGeneral = () => {
    const general = new Command('general');
    general
        .command('genKeypair')
        .description('generate a Blind Find keypair')
        .action(() => {
            const keypair = stringifyBigInts(genKeypair());
            console.log(keypair);
        });
    return general;
}
