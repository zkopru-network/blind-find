<p align="center">
  <a href="https://github.com/mhchia/blind-find/actions?workflow=nodejs"><img alt="GitHub Actions status" src="https://github.com/mhchia/blind-find/workflows/nodejs/badge.svg"></a>
</p>

# Blind Find
*Blind Find* is a peer-to-peer network allowing private peer search proposed by Barry Whitehat and Kobi Gurkan. For the detail specification, please read the [post][blind-find-ethresearch] on ethresearch.

## Install

You can install Blind Find either with [npm](#Install-with-npm) or building it from the [repo](#Build-from-the-repo).

### Install with npm

```bash
npm install -g blind-find
```

### Build from the repo

```bash
git clone git@github.com:mhchia/blind-find.git
cd blind-find
```

Install our rust dependency [`zkutil`](https://github.com/poma/zkutil), which perform proof generation/verification and other stuffs.

```bash
npm run install_zkutil
```

Extract proving and verifying keys from parameters generated from the circuits and trusted setups.

```bash
npm run extract_keys
```

Install NPM dependencies.
```bash
npm install
```

**Optional**: Symlink the package folder. This step makes you able to use Blind Find CLI in your shell by calling `blind-find` instead of `npx ts-node src/cli/index.ts`.
```bash
npm link
```

## Command Line Interface (CLI)

See [CLI document][cli-doc] for all available commands.

## Testnet
Blind Find v1 [contract](https://kovan.etherscan.io/address/0xe57881d655309c9a20f469a95564beaeb93ce73a#code) is on [Kovan][kovan-etherscan] already.

### Public Hub
A testing public hub is available for users to play with on Kovan.
- `hostname`: `blindfind.mhchia.com`
- `port`: `5566`
- `hubPubkeyBased64`: `WyI5NzA4ODY0Mjc4NjQxNzIwMjA3MzQwNjQwODk5MDQ5MDU0MjM5MTgwNDY2ODQzNzU0OTUyMzAxMTc1MzgxNTQ4NTMyMDc0MTc4NDM4IiwiMjEwOTg3MjgxMDM0MDU0ODg1NjYyMTY3MjI3OTI3NDExMzc3MzcxMzgxODg0MDAxOTUzMzY0NjE1MTQ2NjA5MDkxMTQyOTkzNDcyNzEiXQ==`

\[WARNING\]: It's just a small testing hub server right now. There is no guarantee on its running and all data are subject to be erased.

## Get Started

This section goes through how to run CLI as a `User` and interact with the [public hub](#Public-Hub). You will learn how to join the hub, search for yourself through the hub and generate a Proof of Indirect Connection, and verify the proof.

Recap: A user can do the following things with a hub
1. Join a hub and can be searched by other users.
2. Search for other users. If user A successfully finds user B, user A can generate a Proof of Indirect Connection to prove it can reach B through some hub.

Then let's try Blind Find [CLI][cli-doc]. Assume Blind Find is correctly [installed](#Install) and shell command `blind-find` exists. If not, run CLI with `npx ts-node src/cli/index.ts`.

A data directory `$HOME/.blind_find` along with a config file `$HOME/.blind_find/configs.yaml` are created when you execute the command first time.

```bash
$ blind-find
ConfigError: ~/.blind_find/configs.yaml is not found and thus a template is generated. Complete the template and try again.
    at Function.loadFromDataDir (/Users/mhchia/projects/work/applied-zkp/blind-find/lib/cli/configs.js:205:23)
    at async main (/Users/mhchia/projects/work/applied-zkp/blind-find/lib/cli/index.js:52:20)
```

Open `configs.yaml`. You can see network configurations and a pre-generated valid `blindFindPrivkey`, i.e. the `"XXXXXXXXXXXX"` below.

```yaml
network:
  provider:
    network: kovan
    name: infura
    apiKey: Put your infura api key here
blindFindPrivkey: "XXXXXXXXXXXX"
```

By default, we're using [Infura][infura]. We need an API key to access Infura API. Register an account, create a project, and find the API key. It should be the hexidecimal postfix in your project endpoint For example, if your endpoint is `https://kovan.infura.io/v3/123456abcdef123456abcdef`, then `123456abcdef123456abcdef` is the the API key). Paste it to the field `apiKey` like the following.

```yaml
network:
  provider:
    network: kovan
    name: infura
    apiKey: 123456abcdef123456abcdef
blindFindPrivkey: "XXXXXXXXXXXX"
```

If you prefer to use a JSONRPC server, change `name` field to `web3` and `apiKey` to `url`, and paste the endpoint of the JSONRPC server to `url` field.

```yaml
network:
  provider:
    network: kovan
    name: web3
    url: http://localhost:12345
blindFindPrivkey: "XXXXXXXXXXXX"
```

If your configuration is correct then we're ready to go. As a user, all commands you need are under `blind-find user`.

```bash
$ blind-find user
Usage: blind-find user [options] [command]

user join hubs and search for others

Options:
  -h, --help                               display help for command

Commands:
  join <hostname> <port> <hubPubkey>       join a hub
  search <hostname> <port> <targetPubkey>  search for a user through a hub
  getKeypair                               get user's keypair
  verifyProof <proofBase64Encoded>         verify a Proof Of Indirect Connection
  getJoinedHubs                            get the hubs user already joined before
  help [command]                           display help for command
```

Postfix the flag `--help` behind a command whenever you want to learn more about it.

```bash
$ blind-find user getKeypair --help
Usage: blind-find user getKeypair [options]

get user's keypair

Options:
  -h, --help  display help for command
```

To join the [public hub](#Public-Hub), run `join` with the hub's information. The command succeeds if there is no error coming out.

```bash
$ blind-find user join blindfind.mhchia.com 5566 WyI5NzA4ODY0Mjc4NjQxNzIwMjA3MzQwNjQwODk5MDQ5MDU0MjM5MTgwNDY2ODQzNzU0OTUyMzAxMTc1MzgxNTQ4NTMyMDc0MTc4NDM4IiwiMjEwOTg3MjgxMDM0MDU0ODg1NjYyMTY3MjI3OTI3NDExMzc3MzcxMzgxODg0MDAxOTUzMzY0NjE1MTQ2NjA5MDkxMTQyOTkzNDcyNzEiXQ==
```

Then, you should be able to search for yourself. Use `getKeypair` to know your Blind Find keypair.

```bash
$ blind-find user getKeypair
{
        "privKey": "PRIVKEY",
        "pubKey": [
                "PUBKEY_X",
                "PUBKEY_Y"
        ],
        "pubKeyBase64Encoded": "PUBKEY_BASE64_ENCODED"
}
```

Run `search` with the hub's information and your public key encoded in base64 (i.e. the value in `pubKeyBase64Encoded` field) as the public key of the target user. It will take a few minutes or longer depending on how many users have joined the hub. When the command finishes, you will get a Proof Of Indirect Connection encoded in base64 in `base64Encoded` field. Because you are simultaneously the searcher and the target, both `pubkeySearcher` and `pubkeyTarget` fields should be your public key encoded in base64.

```bash
$ blind-find user search blindfind.mhchia.com 5566 PUBKEY_BASE64_ENCODED
{
        "pubkeySearcher": "PUBKEY_BASE64_ENCODED",
        "pubkeyTarget": "PUBKEY_BASE64_ENCODED",
        "adminAddress": "0xe75B72f46f34D8505382a35f4832FF41761611bB",
        "merkleRoot": "11006367961791971092113606774938408370281609027794134241388950976069851532161",
        "base64Encoded": "PROOF_BASE64_ENCODED"
}
```

Verify the proof with the command `verifyProof` with the proof in `base64Encoded` field. Because the proof is valid, you should see `"Proof is correct!"`, along with the proof information. Otherwise, you might either paste the proof incorrectly or there is anything wrong in the codebase.

```bash
$ blind-find user verifyProof PROOF_BASE64_ENCODED
Proof is correct!
{
  pubkeySearcher: 'PUBKEY_BASE64_ENCODED',
  pubkeyTarget: 'PUBKEY_BASE64_ENCODED',
  adminAddress: '0xe75B72f46f34D8505382a35f4832FF41761611bB',
  merkleRoot: '11006367961791971092113606774938408370281609027794134241388950976069851532161'
}
```

[blind-find-ethresearch]: https://ethresear.ch/t/blind-find-private-social-network-search/6988
[kovan-etherscan]: https://kovan.etherscan.io/
[cli-doc]: src/cli/README.md
[infura]: https://infura.io
