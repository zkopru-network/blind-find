import { Command } from "commander";
import { buildCommandAdmin } from "./admin";
import { buildCommandGeneral } from "./general";
import { buildCommandHub } from "./hub";
import { buildCommandUser } from "./user";

async function main() {
  const program = new Command();
  await program
    .version("0.0.1")
    .description("Blind Find v1")
    .addCommand(buildCommandGeneral())
    .addCommand(buildCommandAdmin())
    .addCommand(buildCommandHub())
    .addCommand(buildCommandUser())
    .parseAsync();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
