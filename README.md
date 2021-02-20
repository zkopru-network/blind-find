<p align="center">
  <a href="https://github.com/mhchia/blind-find/actions?workflow=nodejs"><img alt="GitHub Actions status" src="https://github.com/mhchia/blind-find/workflows/nodejs/badge.svg"></a>
</p>

# Blind Find v1
*Blind Find* is a peer-to-peer network allowing private peer search proposed by Barry Whitehat and Kobi Gurkan. This repo implements the first version of Blind Find (i.e. **Blind Find v1**). Please read [Blind Find v1 Spec](specs/blind_find_v1.md) to learn how it works.

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

## Get Started
Before proceeding, you should read sections Introduction and Roles in the [spec](specs/blind_find_v1.md) to know what the roles are doing.

### Testnet
Blind Find v1 [contract](https://kovan.etherscan.io/address/0xe57881d655309c9a20f469a95564beaeb93ce73a#code) is on [Kovan][kovan-etherscan] already.

### Public Hub
A testing public [hub][spec-hub] is available for users to play with on Kovan.
- `hostname`: `blindfind.mhchia.com`
- `port`: `5566`
- `hubPubkeyBased64`: `WyI5NzA4ODY0Mjc4NjQxNzIwMjA3MzQwNjQwODk5MDQ5MDU0MjM5MTgwNDY2ODQzNzU0OTUyMzAxMTc1MzgxNTQ4NTMyMDc0MTc4NDM4IiwiMjEwOTg3MjgxMDM0MDU0ODg1NjYyMTY3MjI3OTI3NDExMzc3MzcxMzgxODg0MDAxOTUzMzY0NjE1MTQ2NjA5MDkxMTQyOTkzNDcyNzEiXQ==`

\[WARNING\]: It's just a small testing hub server right now. There is no guarantee on its running and all data are subject to be erased.

### Command Line Interface (CLI)
See [CLI document][cli-doc] for all available commands.

### Play with User CLI
This section goes through how to run CLI as a [User][spec-user] and interact with the [public hub](#Public-Hub). You will learn how to use CLI to join the hub, search for yourself through the hub and generate a [Proof of Indirect Connection][spec-proof-of-indirect-connection], and verify the proof.

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

By default, we're using [Infura][infura]. We need an API key to access Infura API. Register an account, create a project, and find the API key. It should be the hexidecimal postfix in your project endpoint. For example, if your endpoint is `https://kovan.infura.io/v3/123456abcdef123456abcdef`, then `123456abcdef123456abcdef` is the the API key. Paste it to the field `apiKey` like the following.

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

Postfix the flag `--help` behind a command whenever you want to learn more about the command.

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

### More about Hub and Admin
For normal users, it should be just enough to play with User CLI. If you want to set up your own hub or admin, you can follow the following instructions.

#### Play with Hub CLI
To setup a new [hub][spec-hub], you need to be registered by the admin first.

Call `createHubRegistry` to get your hub registry encoded in base64, i.e. the content inside the field `base64Encoded` in the output.

```bash
$ blind-find hub createHubRegistry
{
        "sig": {
          ...
        },
        "pubkey": ...,
        "adminAddress": ...,
        "base64Encoded": "HUB_REGISTRY_BASE64_ENCODED"
}
```

Send the hub registry encoded in base64 to admin. Admin should then call [`admin addHub`](#Play-with-Admin-CLI) to add your hub registry to the merkle tree and commit it on chain, and then send you your hub registry along with the merkle proof encoded in base64.

Set your hub registry along with the merkle proof encoded in base64 in your database. If the command succeeds, then registration is done.

```bash
$ blind-find hub setHubRegistryWithProof <HUB_REGISTRY_WITH_PROOF_BASE64>
```

Serve as a hub server, which allows users to join and search. Users need your `hostname`, `port`, and your hub public key to `join`, while they only need `hostname` and `port` to `search`. To stop the hub server, just press `Ctrl-C`.

```bash
$ blind-find hub start
{"message":"HubServer: Listening on port 5566","level":"info"}
Hub is listening on { address: '0.0.0.0', family: 'IPv4', port: 5566 } , with pubkey in base64 = ...
Press Ctrl-C to exit
```

#### Play with Admin CLI
Admin is the admin of [Blind Find v1 contract](contracts/BlindFindContract.sol). To become the admin of your own Blind Find v1 network, you need to deploy a Blind Find v1 contract on Ethereum network. [Admin CLI](src/cli/README.md#Admin) now only works with an [Externally Owned Account (EOA)](eoa), instead of contracts.

Add the `address` and `atBlock` (block number where the contract resides) of your own Blind Find v1 contract address in the field `customContractAddress` in `configs.yaml`.

```yaml
network:
  provider:
    network: kovan
    name: infura
    apiKey: 123456abcdef123456abcdef
    customContractAddress:
        address: CONTRACT_ADDRESS
        atBlock: CONTRACT_AT_BLOCK
blindFindPrivkey: "XXXXXXXXXXXX"
```

Also, add the private key of your EOA which deployed the contract in `admin.adminEthereumPrivkey` your `configs.yaml`.

```yaml
network:
  provider:
    network: kovan
    name: infura
    apiKey: 123456abcdef123456abcdef
    customContractAddress:
        address: CONTRACT_ADDRESS
        atBlock: CONTRACT_AT_BLOCK
blindFindPrivkey: "XXXXXXXXXXXX"
admin:
  adminEthereumPrivkey: "0x1234567890123456789012345678901234567890123456789012345678901234"
```

To register a hub, call `addHub` and input the `hubRegistry` encoded in base64 generated by the hub requesting to be registered. Output is the merkle proof of the `hubRegistry` in the hub merkle tree. Make sure to send it back to the hub so that the hub can prove it has been registered.

```bash
$ blind-find admin addHub <hubRegistryBase64>
HUB_REGISTRY_WITH_PROOF_BASE64
```

[blind-find-ethresearch]: https://ethresear.ch/t/blind-find-private-social-network-search/6988
[kovan-etherscan]: https://kovan.etherscan.io/
[infura]: https://infura.io
[eoa]: https://ethdocs.org/en/latest/contracts-and-transactions/account-types-gas-and-transactions.html#externally-owned-accounts-eoas

[cli-doc]: src/cli/README.md
[spec-admin]: specs/blind_find_v1.md#Admin
[spec-hub]: specs/blind_find_v1.md#Hub
[spec-user]: specs/blind_find_v1.md#User1
[spec-proof-of-indirect-connection]: specs/blind_find_v1.md#Proof-of-Indirect-Connection
