import { Command } from "commander";
import { buildCommandAdmin } from "./admin";
import { loadConfigs } from "./configs";
import * as defaults from "./defaults";
import { buildCommandGeneral } from "./general";
import { buildCommandHub } from "./hub";
import { buildCommandUser } from "./user";

// TODO: Workaround w/ the fact that options in root is not inherited
//  https://github.com/tj/commander.js/issues/1229.
async function main() {
  const program = new Command();
  program
    .description("Blind Find v1")
    .version("0.0.1")
    .enablePositionalOptions()
    .passThroughOptions()
    .option(
      "-d, --data-dir <dir>",
      "directory where stores data blind find uses",
      defaults.dataDir
    )
    .parse();
  const globalOpts = program.opts();
  // TODO: Parse user's options (what inside configs.yaml) and create `IConfig`.
  const configs = await loadConfigs(globalOpts.dataDir);
  await program
    .description("Blind Find v1")
    .addCommand(buildCommandGeneral(configs))
    .addCommand(buildCommandAdmin(configs))
    .addCommand(buildCommandHub(configs))
    .addCommand(buildCommandUser(configs))
    .parseAsync();
}

/*
1. 不管怎樣，每個指令都要 parse config
2. parse config 需要 config path, 這要從 root option 拿
- If -d dir, then `loadConfigs(dir)`
- If --debug, then console.debug ...
 */

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
