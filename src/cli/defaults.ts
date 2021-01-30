import * as os from "os";
import * as path from "path";

export const blindFindDir = path.join(os.homedir(), ".blind_find");
export const dbDir = path.join(blindFindDir, "db");
export const configsPath = path.join(blindFindDir, "configs.yaml");
export const network = "kovan";
export const provider = "infura";
