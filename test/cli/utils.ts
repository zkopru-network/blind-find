import * as shell from "shelljs";
import * as path from "path";

import { unstringifyBigInts } from "maci-crypto";

const cliPath = path.join(__dirname, "../../src/cli/index.ts");
const cli = `ts-node ${cliPath}`

export const exec = (cmd: string, options?: any) => {
    if (options === undefined) {
        options = { silent: true };
    }
    return shell.exec(`${cli} ${cmd}`, options);
}

export const parsePrintedObj = (s: string) => {
    return unstringifyBigInts(JSON.parse(s));
}