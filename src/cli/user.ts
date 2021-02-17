import { Command } from "commander";
import { PubKey, SNARK_FIELD_SIZE, stringifyBigInts, unstringifyBigInts } from "maci-crypto";
import { TProof, TProofIndirectConnection } from "../circuits";
import { ValueError } from "../exceptions";
import { User } from "../user";
import { bigIntToEthAddress, ethAddressToBigInt } from "../web3";
import { IConfig } from "./configs";
import { CLIFailure } from "./exceptions";
import { base64ToObj, printObj, keypairToCLIFormat, objToBase64 } from "./utils";

export const buildCommandUser = (config: IConfig) => {
  const command = new Command("user");
  command
    .description("user join hubs and search for others")
    .addCommand(buildCommandJoin(config))
    .addCommand(buildCommandSearch(config))
    .addCommand(buildCommandGetKeypair(config));
  return command;
};

const buildCommandJoin = (config: IConfig) => {
  const command = new Command("join");
  command
    .arguments("<hostname> <port> <hubPubkey>")
    .description("join a hub", {
      hostname: "hub's hostname",
      port: "hub's port",
      hubPubkey: "hub's public key in base64"
    })
    .action(
      async (hostname: string, portString: string, hubPubkeyB64: string) => {
        const port = Number(portString);
        const hubPubkey = base64ToObj(hubPubkeyB64) as PubKey;
        validatePubkey(hubPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        await user.join(hostname, port, hubPubkey);
      }
    );
  return command;
};

const buildCommandSearch = (config: IConfig) => {
  const command = new Command("search");
  command
    .arguments("<hostname> <port> <targetPubkey>")
    .description("search for a user through a hub", {
      hostname: "hub's hostname",
      port: "hub's port",
      targetPubkey: "target user's public key in base64"
    })
    .action(
      async (hostname: string, portString: string, targetPubkeyB64: string) => {
        const port = Number(portString);
        const targetPubkey = base64ToObj(targetPubkeyB64) as PubKey;
        validatePubkey(targetPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        const result = await user.search(hostname, port, targetPubkey);
        /*
        const printed = `{
    "pubkeySearcher": [
        "21832474361127537700629442257203235216351119147507069046706747626913259995444",
        "18653945661494841232566954012321900756586611347917605621072824920299006046000"
    ],
    "pubkeyTarget": [
        "21832474361127537700629442257203235216351119147507069046706747626913259995444",
        "18653945661494841232566954012321900756586611347917605621072824920299006046000"
    ],
    "adminAddress": "0xe75B72f46f34D8505382a35f4832FF41761611bB",
    "merkleRoot": "11006367961791971092113606774938408370281609027794134241388950976069851532161",
    "base64Encoded": "eyJwdWJrZXlTZWFyY2hlciI6WyIyMTgzMjQ3NDM2MTEyNzUzNzcwMDYyOTQ0MjI1NzIwMzIzNTIxNjM1MTExOTE0NzUwNzA2OTA0NjcwNjc0NzYyNjkxMzI1OTk5NTQ0NCIsIjE4NjUzOTQ1NjYxNDk0ODQxMjMyNTY2OTU0MDEyMzIxOTAwNzU2NTg2NjExMzQ3OTE3NjA1NjIxMDcyODI0OTIwMjk5MDA2MDQ2MDAwIl0sInB1YmtleVRhcmdldCI6WyIyMTgzMjQ3NDM2MTEyNzUzNzcwMDYyOTQ0MjI1NzIwMzIzNTIxNjM1MTExOTE0NzUwNzA2OTA0NjcwNjc0NzYyNjkxMzI1OTk5NTQ0NCIsIjE4NjUzOTQ1NjYxNDk0ODQxMjMyNTY2OTU0MDEyMzIxOTAwNzU2NTg2NjExMzQ3OTE3NjA1NjIxMDcyODI0OTIwMjk5MDA2MDQ2MDAwIl0sImFkbWluQWRkcmVzcyI6IjB4ZTc1QjcyZjQ2ZjM0RDg1MDUzODJhMzVmNDgzMkZGNDE3NjE2MTFiQiIsIm1lcmtsZVJvb3QiOiIxMTAwNjM2Nzk2MTc5MTk3MTA5MjExMzYwNjc3NDkzODQwODM3MDI4MTYwOTAyNzc5NDEzNDI0MTM4ODk1MDk3NjA2OTg1MTUzMjE2MSIsInByb29mT2ZTTVAiOnsicHJvb2YiOnsicHJvdG9jb2wiOiJncm90aCIsInByb29mIjoiMDk1OTBiNDdlZGViZjI2NDE2NTk0YmM0OTIxMGUxNmYzZGUxMmU3OWZkMmUwNTMzMzY1ZDQ2ZGFmNDRiNjdmNzE2MWZjYjdhOGY1ZDhjYTM2NTVmNWU1ZmE5MTdlZWQ5ZTc0YWEwMjBlNmViNTRjMWNhNTA3MzM0NzlmYWMzZjUwZWY3ODNhODQyMGEzNjViMzVlNDY2MWU2NzU5MjdmNmZkYjRjOTdlYzQxMTljZTQ2Mjc3YTAzMmIwZDdlYTA1MWUxZGJiNzkyY2RkMmI0OGIxMjk2OTQyMTZjODhhNDcyZmJlNWMwMTRlYThiYTU3ZmMzNTg2OWEyYmY2MzE1NDJiOTUxMjBlZTdmNDI0NzQwMTQwZjY4MGJlNTUwODc0MzcwZjNmMmMzNjYwOWFmNGQwMDEyMWI0ZmExMGVkODQyYWYyZTQyZGRkMmJiMjI2OGZhNmZlOTkxMTY0MDZjOGI2ZTFkMWJkYmUyNDY1MjkxNTMzMmMzYzNhMDUwYzE1MjRlZDkzMmI5YWQxNGIzNTg1YjI0ZDk4ODFiNDhjY2E5YjIzNWUwOGRhODIxMWMzNzUxN2IzMzUxYjRjZWRjNTI4MDNiYjNkYTVlY2ZlNTFkYzQ2OTRiYjBmYTEwODA3ZmVmNGMyN2VkN2RmODA5ZTRkNmNiYzQyZTA4N2YzM2EiLCJwaV9hIjpbIjQyMjgxNDI4ODQ0MzY3Nzc3OTAwNDU0Njc3MjQ1OTg4MDA5MzA2NTA0OTM5MjkwNjc5MDA2NTEwNjUyODI1Nzk3MTY3NzM3MzQzOTEiLCIxMDAwNzA1OTI4NjU2MDAyNDAyMTc5Nzk0MDExMjE2OTUyODgzMTY0NzUxNzAwNjk4MzA2MDc2MDMwNTQ3OTQ0OTI0ODE2NzI4MTY1MyIsIjEiXSwicGlfYiI6W1siMTM2MjE5MTc5MTU4MjE2ODU4NzIyNTMwNDA1OTM1NTE0MDQzMzQ5MTA4MTAzMTUyNTI2MTE1NzU0MDE0NTE2MDY2OTUzMDY3MzU5NTYiLCI2NzY5Njk5NzcwMTYzMjcyMzcwNTA3NDA5OTEyNTMwODQ5ODM4NTgyNzI1MDA0OTU1MDQ4NTc3ODY5NjYyNjYzODQ3MDk3OTIwMDA1Il0sWyIxOTQyNjI5MTQ2NDgzMDIxNzQ5OTUyNzUyODU3MjgwNTAyNjkwMjE5NTk5MzkzMzE1NzQ4NjQwOTc4NzI0Mzk2ODAyNzA2ODUzMzc4MSIsIjE5NzEyODM3MzM1MDMzNTAzMjY2Nzk1NDIxNjI5NTMxMTI0MTY5MTc4NTI3NjA5NjAzMDg0OTY1NjUwMjMwNjY2Mjk2MjM5OTEwMjc2Il0sWyIxIiwiMCJdXSwicGlfYyI6WyIxNjcwMzAyMTAzNTY0NDk0MzM1NDMwMDk1NTA3NzEyNjY4NjM4MTY1NzEyNzM0OTQ2Njc4NTEzMDY1MzYyMzAyMDczOTY1NzI2NDU4MSIsIjE4MDk5MTA2NzczMTIyNjA4Nzg5ODQyNTA4MDA0MjQxOTEyMTQ4Njg4Njg5NjgzNTA0ODM4NzQzNjgzMjMxODAwMTQ3ODY0NzExOTk0IiwiMSJdfSwicHVibGljU2lnbmFscyI6WyIxIiwiMjE4MzI0NzQzNjExMjc1Mzc3MDA2Mjk0NDIyNTcyMDMyMzUyMTYzNTExMTkxNDc1MDcwNjkwNDY3MDY3NDc2MjY5MTMyNTk5OTU0NDQiLCIxODY1Mzk0NTY2MTQ5NDg0MTIzMjU2Njk1NDAxMjMyMTkwMDc1NjU4NjYxMTM0NzkxNzYwNTYyMTA3MjgyNDkyMDI5OTAwNjA0NjAwMCIsIjEzMjA4MTYyNDk4NTA2ODU2NjA1MTQxODA4MzY4MjgxNTgxOTcwMDcyOTE2NTA0OTEiLCIxMTAwNjM2Nzk2MTc5MTk3MTA5MjExMzYwNjc3NDkzODQwODM3MDI4MTYwOTAyNzc5NDEzNDI0MTM4ODk1MDk3NjA2OTg1MTUzMjE2MSIsIjE1NjgyNzQzMTk4NTg2NjgwMTA0OTExODY4OTIzNjA3MDkxNzcwNjM3NzgxOTUzNzM3NTM3ODM1MTA0ODg5NTA4NDU1MDQ2ODg3NzA3IiwiMTkxMDIwODM0ODE3NDEzODcyNDE4NjEyMzg3NTMzNjEzMTE4Njg5MzMwMTY5NTgzOTIyMjA0NDMzNzg2NjgyNjc0MTQ2NzAyMDA2NzgiLCIzMzg2MDE4OTM5Nzk4Mzk4NjQ3MzExNTA1MTIxMjg1MTY4MDUxNjE5Njk1NTExMTg3MDkyMzQyODY5MTA5NzE4NDA0NjAyMzEyNzEwIiwiOTkxNTE5MDcxNTcwMDY0NTM4MTQ0NDQxMzc3Mzg1MzkyOTQ1MTg3MzM2MzMxNjYxNTc5NDg2ODE3NDY2NDc0NDkxMTg0NDc2NjQ5IiwiMTkxMzUwODcwMTE1NDg5NTI3MzI0MTIxNTg3MjYyMDIyMDI0Njg4NjI0NjE1NzY4NzY1MzM4MDc4MDg5NjM3MjkxMjUzMzUwODMzMzQiLCIyMTQ1NzA5MjM3MTc2MTgwOTQ2Njk1OTM0MjI3MzA5Mzg3ODEwMzM2OTg1NjAxNDI2MTMzNzU4MTg2OTU1MDgzNzU5NTk2MjUyMjIyNSIsIjE2MDU5MjA0ODAzMjIyMjA4Njk3Mzc1NTQzOTc4MDQxMDIzNDA2NDg0NjgxODA0MTEzMTQyNzg3Mjk2Njc0NzU0OTMzNDg5NDYyOTk4IiwiMTA4NDQwNDcxNzUyMjcyMTc1NjYwOTU3NTcyMjE0NTQ4OTU0ODc1NDkwNDI4MTY2ODkwNTY0MjEzMDA1MjM1NTU3ODUzMDc1NjgyMyIsIjE1NTczNjI3MzgzODgyNzg4MzI1NTM4NTQ2MDY4MTM3OTQ1NTQyMTY4NjAzMDM5ODYxMjUyMTQ3MTQ2NTA0MjA2NTQ0NzMxMzgxMjk5IiwiNTU5OTI3MDUyMTMwNDcwNzE3NTMxMjU5NTI4ODM5MDE0MDYyNjMxMTQzODI5NzEzNTAyNjA2NjU2MDkzNjIwNzM5MDA4MDAzODYzMCIsIjExNjMxNTI5MTU1MjkyMzI3NzcwMzM5OTY5NDYxODkwMDMwMTU2NTAxNDY3NzE2MzI4OTE5NjE3MzIzMjAyMDQxMzYxNTA5NTMzMjkwIiwiMjQwMzIyMjM2OTg5NDIyMDc3NDgyNDk0ODA4MzU5MzQzMzM5ODM3NDA1NzQ5OTA1OTkxMDcwMDA4NTk2NDU4NTgzNjg4MDEwMTE1MyIsIjIwNjI3MDkzNjQxNTIwOTA3MDM3ODkxNzkzMDc2NjAzODQyMTcxMTA5OTkwNjg5MjU2MDAyMTUxMDY4ODcxMjc1NjQwNzY2OTE1ODQ2IiwiMjAxNTU4NDU0NTE5MjY2ODYyMDQxMjg0ODE5MDAyMTIyMzMxNTkzODIzMDUzMjkwMzcwODQxODIzNTQxNTgxNTA4ODYwNTM0MTkxMiIsIjM5ODYyNTk3ODg1MTUzMjI5Mzc5OTQ3ODI3NDQ4NzUxMDgzNTg1ODc4Mzk1MTM3ODk4NDMyODU1NTQ1NzA2NzY3OTg4Nzc5MDg4OCIsIjE4MDMzNDc4MDUyNjIzMzQ4NjIwNjU3MzQ3NTA5MjI1MzM5NTYxNzgzNDYyODA3NjU1NjMyNjE0MjQxNDc5MDcyNjg4Mjc1ODA0MjAiLCIyMDY2ODU0MzM3ODE1OTIyNjc5MzA4NTk3NjA4NDc3ODMzMjUxNjY5Mjg1NTI5NjE4MTg1MTUxNzA4MTYzMjU3MzM4OTI0MDU1OTcxMCIsIjExNDIxNTU1NTE2MDg0MDE4MDU2NDk4MDU5MTY2MTYwMjI2NDE1NDE2NDU5MTA2NzUyMzMxNTI3NzM0ODU2NDQwMjQ3MzQ2NTQ0NjE4IiwiNjEyMjE5NDkwMzU1Nzk2OTA5Mjc0MTQ5ODA0MjgxNzY2MDY0MDU5NTA0MjA3MTA4Mjk5NTg0ODA3MDgzNjU5MjUyNDg0MTEyNzI5MiIsIjEwNTE2NzM5ODA1NTE1OTkyNzMzOTMwMTU2NTIwMDYyNzczMzgyMjIzMDQwNjcyNTI2MzA0NDc3MTUyNzM5Mzc0NDAxNTAyMDQxNjU2IiwiNTUzODUyMzA5MTg5MTkxMzk4MDc3OTMyOTkyMzQ5MTkyMjk0NzQ4MzYxNjkwMzU3MjcwNjc5NDMyOTYxNDU3NjI2NjUzMTI1NDQyNiIsIjU2MzgxMjc4NzAwMzM0MDc2ODY3MDA3MjQxNzAxNDQ4MjkxNDYzMDMyMzMzMjgyMjMxNTcyODYxMjg0MDk3MDQ2MzM3NjEyNzg4MCIsIjIyNTg3NzA5ODk0NzE2NTk0MzU0MzMzOTg2NDc0MzI2OTY0NDMyNjI0MDUyMTEyODk1Mzk4NzA1NTU4NzA2MTY3NjE3MjE0NzAwODciLCI1NzU2NDgxMDA1NTA3ODkyMDkyODcwMzI3OTI1MTg3NjYzNTE3MTY0MTg1MzU5OTg3NzI0ODcyMTY1MzYyMDQ2NTk5Njc2Nzc3OTI1IiwiODMwMjAzNTg5NzM5MTg1OTU3Mjk3NjU5OTEwOTc5MTk1MTk3NTE0OTgxNzgyMTQ0MjE2NjQ4NjU4MDgxMDIwNjA2MDgwNzYxMDU4NiIsIjYxMTI1NDU2ODU0MDA2NDI5MDQ1ODc5OTkwNTQwMTMyMDg2NDUyOTc5OTE5OTgyMTEwNzY1MTEwNzMxNTA2Nzk0MDQ2NjE2NTQ3MTYiLCI4MzAzMDI2OTI2NDk3OTg5NjI1MDU0MzQwNzYxOTMxNDA1MDQ1NjU3MDk2OTQzOTIzMTQ4NTE4NjU4OTQwOTczMDE5NzkwMzIyOTg5IiwiMTI5OTcxNDc2MDg0ODYzNzg2MTE3ODYxODU5MzM4ODIzMjM0NzIwMjQ5MzUwMTQ0ODYwODEwMDI4ODg0NTg2MDM1OTk5NzQ2NDI5NDUiLCIyNjE0MDQyMTkyNTQxMDM5OTQ5NTczNjIwNjcwODI5NDkwNTcxOTE0MDg5NTExMzA4MTY1MDY3MzUwMTExODA1NzI1NjYwMDUwMzEzIiwiMTgyNDU1MTMyODU0NjEzMTkxNDYzMzgyNTc4MDgwNTIyMjEyODU2MzI3NzM1NjQ3MjQxMzM4NDQzODU2NDc1NTM5Nzc0MjIwMDI5OCIsIjkyODk3Mjc5MjU0Mzc4NDE2ODY3MDY4MjEyNTI5ODkwODIyNDE1MDE0MDA0NTY0NzY3ODI0NzI3NjU4OTk1NTk0Nzc2MTExMzM4MzUiLCIxNjEzMjU4NzQ0ODExMDExNDUyNzI2MTU3MzI4MjMzOTA4NTM3ODYyNjUyNzYxODU4ODMyODU1MDY0Mjg2MzcyNDU0NDYzNzc4ODQxNCIsIjIxNTM0NDM3OTA2MDcxNDg1NzI2MzMyNzEyNzcyMjgyNTg5MjA4Nzg5NDk3NTAzOTEyMDY0MDM0MzI1MDAwNzQ1NDQ0NTk2ODM3NTUwIiwiMjI1MjEyNDYwMTc4OTIzMjgxNTE5NDc3ODM4NTI5NDk5OTY4NDk3MTMwMDAyOTg2NTEzODM5NDQwNjQwNzE4Njc1MjQ2MTI2MDQ3MSJdfSwicHJvb2ZTdWNjZXNzZnVsU01QIjp7InByb29mIjp7InByb3RvY29sIjoiZ3JvdGgiLCJwcm9vZiI6IjE4M2ZiNWQwODk3ZGIxZjg2ZGFlN2ZjZTdlODUyYTE3YjA1MjU2NzQ0Y2JiYjBhMmViZmFjMmQwOTRlMzVlMTcxZjQzZjBiNTNhN2JhYmIyZjY4ZjFkNzA4NjQ4MWQxNDkzYjg2ZDhkOGQ1N2E3MGI2MWQ3NjJlMGM1OGEwZjljMDgzODFhYzEyZDdkZjA0NTQ5ZTQzZDVkZTc2MDFlN2IzODUzODcxYmVkMmQ1NWRkNTJhNTc2MzBlM2IyYTYxODE2ODk2NzQ3NzcyYzUwZTEzZGFiYTUwZTJjZmQxODk2ZTVhNzE5OGZiZTM1ZGIzNmNmY2ZlOWQ4MmZlMjg2MjYxOGFiY2Y1NDA0ZGU3N2RlNWEzZTgzOTVjZjAyMTE2YjA4ZjNhODY2YjRlZWZlYTQ2MjdlNzE5NzczZGMzY2FhMjA5MzQ1ZGVlYTI2ZDA4MTY5MDI3ZTg4NzJkZTE4ZWE3MjQyODhlOThlNzlmNDU2NGUwMzBhZjI5MTkwMTE1ZDJlNGI2YzM1Y2M1OGNlNDgzMDY0ZjI5NDA0MDY4YzE4ZmVlMTM4MTk4NjAyMTY1YmMwZGRjOWQ1MjUxMzRmOTgxMDY3ODlmZTUwZWY5MzVmZWUzNWZiNmIwNjI2NDI3YTQ2OTc3OTg5ZjE0ZTNkYjBjZTBlZTFkZTMzZGRmYmM4IiwicGlfYSI6WyIxMDk2ODA3NDU2OTMxNjU5OTM1NjU1NTIwMjk4MjY3OTExNzgxMzQyMDUxOTY4OTk4NDExMTIwNjYxMzE2OTMxNjg0ODQ1NTYwNTc4MyIsIjE0MTQxNzM4MzY0NDUzOTc0MzcwOTE5MTQ4MzE3NDExNjM3OTY5MTkxMzMwNDgyNDMyNzY4MDgyMDc3NDIzMzM0NDI2OTc3ODk4Mzk2IiwiMSJdLCJwaV9iIjpbWyIxMDE5MzY1MzUyMzI4NjgyNTIyMDcyNDAwMDA5NjI2NDA4MzEyMjYwNjM2NzQ1MDc5MDIwOTAwMDQwMDkxMzY2OTA5NjIyMzE4MDMyNiIsIjM3MTc2MzA4Nzc3NTkzMDUxODY3MzkwMzA0MTg3NTkwMjY2OTE4ODg4NzE4NTUwODk4Njc2NTM2NDYxNTg4NzY5OTQ3Njk2OTIxODQiXSxbIjE0NzM0MjE5OTAzNDUyMDc5MTc5OTA5NTc5NTY0NzEzNTgxNzA5MjgyMjg0ODc2NjU5NjQ4NTAyMDgzMzQ0ODc0NTkwOTYyNzE3MDIxIiwiMTExNTkwNzAxNDA3MTc1NzAwMTk2Mzg0NTQ0NTI0MzM2NzcwMjE5Nzc5MTI5MjI0NjMwNTE4ODk0NjUwMjIzNjYwMjk4ODk0MjA0NTgiXSxbIjEiLCIwIl1dLCJwaV9jIjpbIjIwOTM5NjUxNDAzNjkxNDk5NTEyNzg2NDExMTAzMjE5NzkxMTQxMTQ4OTUwNDgzNTU0NjU4NjA5OTU2MjUyODIwNDAxNDkzODU2MTUyIiwiNzQxOTk0MzIyMDYwMzkzODYxNjI2NDI1NDAyMDUxMzI3MTQ4MTk0OTg0OTE5MzIyOTEzNDA0NzA2ODgwMjc3MjU0MjY0NzMwMzExMiIsIjEiXX0sInB1YmxpY1NpZ25hbHMiOlsiMSIsIjIxODMyNDc0MzYxMTI3NTM3NzAwNjI5NDQyMjU3MjAzMjM1MjE2MzUxMTE5MTQ3NTA3MDY5MDQ2NzA2NzQ3NjI2OTEzMjU5OTk1NDQ0IiwiMTg2NTM5NDU2NjE0OTQ4NDEyMzI1NjY5NTQwMTIzMjE5MDA3NTY1ODY2MTEzNDc5MTc2MDU2MjEwNzI4MjQ5MjAyOTkwMDYwNDYwMDAiLCIyMDY2ODU0MzM3ODE1OTIyNjc5MzA4NTk3NjA4NDc3ODMzMjUxNjY5Mjg1NTI5NjE4MTg1MTUxNzA4MTYzMjU3MzM4OTI0MDU1OTcxMCIsIjExNDIxNTU1NTE2MDg0MDE4MDU2NDk4MDU5MTY2MTYwMjI2NDE1NDE2NDU5MTA2NzUyMzMxNTI3NzM0ODU2NDQwMjQ3MzQ2NTQ0NjE4IiwiNTc1NjQ4MTAwNTUwNzg5MjA5Mjg3MDMyNzkyNTE4NzY2MzUxNzE2NDE4NTM1OTk4NzcyNDg3MjE2NTM2MjA0NjU5OTY3Njc3NzkyNSIsIjgzMDIwMzU4OTczOTE4NTk1NzI5NzY1OTkxMDk3OTE5NTE5NzUxNDk4MTc4MjE0NDIxNjY0ODY1ODA4MTAyMDYwNjA4MDc2MTA1ODYiLCI5Mjg5NzI3OTI1NDM3ODQxNjg2NzA2ODIxMjUyOTg5MDgyMjQxNTAxNDAwNDU2NDc2NzgyNDcyNzY1ODk5NTU5NDc3NjExMTMzODM1IiwiMTYxMzI1ODc0NDgxMTAxMTQ1MjcyNjE1NzMyODIzMzkwODUzNzg2MjY1Mjc2MTg1ODgzMjg1NTA2NDI4NjM3MjQ1NDQ2Mzc3ODg0MTQiXX19"
}`;
        const result = parsePrintedProofIndirectConnection(printed);
*/
        if (result === null) {
          console.log(`Not Found: user = '${targetPubkeyB64}'`);
          process.exit(1);
        } else {
          console.log(outputProofIndirectConnection(result));
        }
      }
    );
  return command;
};

const buildCommandGetKeypair = (config: IConfig) => {
  const command = new Command("getKeypair");
  command.description("get user's keypair").action(async () => {
    printObj(keypairToCLIFormat(config.getKeypair()));
  });
  return command;
};

const loadUserSettings = async (config: IConfig) => {
  const blindFindContract = config.getBlindFindContract();
  const adminAddress = await blindFindContract.getAdmin();
  const userKeypair = config.getKeypair();
  const db = config.getDB();
  return {
    blindFindContract,
    adminAddress,
    userKeypair,
    db
  };
};

const validatePubkey = (pubkey: PubKey) => {
  if (
    pubkey.length !== 2 ||
    typeof pubkey[0] !== "bigint" ||
    typeof pubkey[1] !== "bigint" ||
    pubkey[0] < BigInt(0) ||
    pubkey[0] >= SNARK_FIELD_SIZE ||
    pubkey[1] < BigInt(0) ||
    pubkey[1] >= SNARK_FIELD_SIZE
  ) {
    throw new ValueError(`invalid pubkey: ${pubkey}`);
  }
};

const stringifyProof = (proof: TProof) => {
  return {
    proof: stringifyBigInts(proof.proof),
    publicSignals: stringifyBigInts(proof.publicSignals),
  }
}

const outputProofIndirectConnection = (proof: TProofIndirectConnection): string => {
  const proofEncoded = {
    pubkeySearcher: stringifyBigInts(proof.pubkeyA),
    pubkeyTarget: stringifyBigInts(proof.pubkeyC),
    adminAddress: bigIntToEthAddress(proof.adminAddress),
    merkleRoot: stringifyBigInts(proof.merkleRoot),
    proofOfSMP: stringifyProof(proof.proofOfSMP),
    proofSuccessfulSMP: stringifyProof(proof.proofSuccessfulSMP),
  }
  const p = {
    pubkeySearcher: proofEncoded.pubkeySearcher,
    pubkeyTarget: proofEncoded.pubkeyTarget,
    adminAddress: proofEncoded.adminAddress,
    merkleRoot: proofEncoded.merkleRoot,
    base64Encoded: objToBase64(proofEncoded),
  }
  return JSON.stringify(p, null, '\t');
}

const parseProofIndirectConnectionBase64Encoded = (base64Encoded: string) => {
  const proofIndirectConnection = base64ToObj(base64Encoded);
  return {
    pubkeyA: proofIndirectConnection.pubkeySearcher,
    pubkeyC: proofIndirectConnection.pubkeyTarget,
    adminAddress: ethAddressToBigInt(proofIndirectConnection.adminAddress),
    merkleRoot: proofIndirectConnection.merkleRoot,
    proofOfSMP: proofIndirectConnection.proofOfSMP,
    proofSuccessfulSMP: proofIndirectConnection.proofSuccessfulSMP,
  }
}

export const parsePrintedProofIndirectConnection = (p: string): TProofIndirectConnection => {
  const printed = unstringifyBigInts(JSON.parse(p));
  return parseProofIndirectConnectionBase64Encoded(printed.base64Encoded);
}
