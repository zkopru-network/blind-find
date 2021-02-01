import * as os from "os";
import * as path from "path";

export const dataDir = path.join(os.homedir(), ".blind_find");
export const dbDir = path.join(dataDir, "db");
// FIXME: Separate roles DB for now, to avoid locking when testing
//  different roles simultaneously.
//  In the future, we should use separate different `dataDir` for each role.
export const dbAdmin = path.join(dataDir, "db_admin");
export const dbHub = path.join(dataDir, "db_hub");
export const dbUser = path.join(dataDir, "db_user");
export const configsPath = path.join(dataDir, "configs.yaml");
export const network = "kovan";
export const provider = "infura";
const hour = 3600 * 1000; // 3600s
export const defaultHubRateLimit = {
  join: { numAccess: 100, refreshPeriod: hour }, // 100 joins per hour
  search: { numAccess: 100, refreshPeriod: hour }, // 100 searches per hour
  global: { numAccess: 200, refreshPeriod: hour } // 100 joins per hour
};
