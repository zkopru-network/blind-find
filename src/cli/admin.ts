import { Command } from "commander";
import { Admin } from "../admin";
import { hubRegistryToObj, HubRegistryTreeDB } from "../dataProvider";
import { LevelDB } from "../db";
import { loadConfigs, parseAdminConfig } from "./configs";
import { dbDir } from "./defaults";
import { getBlindFindContract } from "./provider";
import { base64ToObj, objToBase64 } from "./utils";
import { objToHubRegistry } from "../dataProvider";
import { THubRegistryWithProof } from "../hub";

export const buildCommandAdmin = () => {
  const adminCommand = new Command("admin");
  adminCommand
    .command("addHub")
    .arguments("<hubRegistry>")
    .description("add a hub registry to the merkle tree", {
      hubRegistry: "a `THubRegistryObj` object encoded in base64"
    })
    .action(async (hubRegistryB64: string) => {
      // Example input: 'eyJzaWciOnsiUjgiOlsiMTYwODk5NjE4OTM5NTIxMDE1OTk4NzE3ODQ4Mjg5NzUzMTI0MjQzMDIxNjMwMTI2MjgzOTYzMTc5MjY0ODE5ODUzMjAzNTM2NTQ4MzAiLCIxMjM4MTQ0NzE3MjQyOTY3MDEzNDAxMDMyODc2MTAxMzA4MDk4NjA1OTczODIyMTY3MTk0MzI5MTgxNzE5MTM0OTA3NjE2MTE0NTcxMiJdLCJTIjoiMTc1ODgzOTAyNzE3MTU4ODQ5NDA0MzU3MDUwODk0MTczMDM4MjkyNDMxMjk0OTUwMDE1NzY5MTA2MjI5NjYyMTY5MjA5NjIyMjA3In0sInB1YmtleSI6WyIxMDA4NTIxODIxOTYxNTQ4MTY4NzI3OTU4OTEzNzk1NjMwNDA1MzYyMzk1OTU1MDk0MDcyNDUzMDY0MTU0NDY0ODE0NzM2NTEwMzg0NSIsIjE5MDM3MDY2MDA2NDI1Mjg3MTczMDIzNTgxNDE1NTA2Nzg0NTk2Nzg1MTkwMjE5ODI4MDY2NzE1MDc3Njg1MjU2MDQ3MjQ5NDc5MjgyIl0sImFkbWluQWRkcmVzcyI6IjEzMjA4MTYyNDk4NTA2ODU2NjA1MTQxODA4MzY4MjgxNTgxOTcwMDcyOTE2NTA0OTEifQ=='
      const hubRegistry = objToHubRegistry(base64ToObj(hubRegistryB64));
      const admin = await getAdmin();
      await admin.insertHubRegistry(hubRegistry);
      const index = admin.treeDB.getIndex(hubRegistry);
      if (index === undefined) {
        throw new Error("internal error: index shouldn't be undefined");
      }
      const hubRegistryWithProof: THubRegistryWithProof = {
        hubRegistry: hubRegistryToObj(hubRegistry),
        merkleProof: admin.treeDB.tree.tree.genMerklePath(index)
      };
      console.log(objToBase64(hubRegistryWithProof));
    });
  return adminCommand;
};

const getAdmin = async () => {
  const configs = await loadConfigs();
  const networkConfig = configs.network;
  const adminConfig = parseAdminConfig(configs);
  const blindFindContract = getBlindFindContract(
    networkConfig,
    adminConfig.adminEthereumPrivkey
  );
  const levelDB = new LevelDB(dbDir);
  const treeDB = await HubRegistryTreeDB.fromDB(levelDB);
  return new Admin(blindFindContract, treeDB);
};