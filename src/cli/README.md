# Blind Find CLI

## Command Line Interface (CLI)

`src/cli/index.ts` provides CLI. There are 4 subcommands: [general](#General), [admin](#Admin), [hub](#Hub), and [user](#User). General subcommand provides general utility functions. The others provide functionalities for their corresponding roles. For example, for general users, only `general` and `user` are useful in most cases. Consult available commands with the option `--help`.

```bash
npx ts-node src/cli/index.ts --help
Usage: index [options] [command]
Blind Find v1

Options:
  -V, --version         output the version number
  -d, --data-dir <dir>  directory storing data blind find uses (default: "~/.blind_find")
  -h, --help            display help for command

Commands:
  general               utility functions
  admin                 admin manages hubs
  hub                   hub lets users join and replies to search requests
  user                  user join hubs and search for others
  help [command]        display help for command
```

### Data directory

```
~/.blind_find/
├── configs.yaml  # Blind Find configuration file
└── db  # Blind Find DB
```

Blind Find stores configurations and data in Blind Find data directory. It is `~/.blind_find` by default and can be changed through the option `--data-dir <dir>`.

```bash
# Using `<dir>` as data directory
$ npx ts-node src/cli/index.ts --dataDir <dir>
```

### Configurations

CLI configurations are defined by the interface [`IOptions`](https://github.com/mhchia/blind-find/blob/b6dbb17c73ffdc3c51172ff76050aa2bb95faa07/src/cli/configs.ts#L65). It can be changed through modifying `configs.yaml`.

When first running CLI command, a template configuration file is generated under the Blind Find data directory. To correctly run Blind Find commands, it is required to complete the necessary fields in configuration file.

```bash
$ npx ts-node src/cli/index.ts
ConfigError: /Users/mhchia/.blind_find/configs.yaml is not found and thus a template is generated. Complete the template and try again.
    at Function.loadFromDataDir (/Users/mhchia/projects/work/applied-zkp/blind-find/src/cli/configs.ts:263:15)
    at main (/Users/mhchia/projects/work/applied-zkp/blind-find/src/cli/index.ts:28:18)
```

The default generated `configs.yaml` is in the following format.

```yaml
network:
  provider:
    network: kovan
    name: infura
    apiKey: Put your infura api key here
blindFindPrivkey: "1234567890"
```

- `blindFindPrivkey`: Required. The Blind Find private key, an EdDSA keypair using BabyJub curve.
- `network`: Required, the networking settings.
    - `provider`: Required. Either [Infura](#Infura-provider) or [Web3](#Web3-provider) is supported.

> Only "kovan" (Kovan testnet) is supported now.

#### Infura provider
- `name`: `"infura"`
- `network`: Required, the ethereum network we are using.
- `apiKey`: Required, Infura's API key.
- `customContractAddress`: Optional. If it is not specified, we use the hardcoded [deployed contracts][deployed-contracts] on the specified network.
    - `address`: Blind Find contract address
    - `atBlock`: the block where the Blind Find contract is deployed

#### Web3 provider
- `name`: `"web3"`
- `network`: Optional, network name.
- `url`: Required, the url which web3 json rpc server is listening.
- `customContractAddress`: Optional. If it is not specified, we use the hardcoded [deployed contracts][deployed-contracts] on the specified network.
    - `address`: Blind Find contract address
    - `atBlock`: the block where the Blind Find contract is deployed

## General

### genKeypair

```bash
npx ts-node src/cli/index.ts general genKeypair
```

Generate a new Blind Find keypair.

## Admin

### addHub

```bash
npx ts-node src/cli/index.ts addHub <hubRegistryInBase64>
```

Add a hub registry to admin's merkle tree. Output is the hub registry along with its merkle proof.

## Hub

### getKeypair

```bash
npx ts-node src/cli/index.ts hub getKeypair
```

Output hub's keypair.

### createHubRegistry

```bash
npx ts-node src/cli/index.ts hub createHubRegistry
```

Create a hub registry by signing a `RegisterHub` message with its keypair. To be registered as a valid hub, this hub registry must be sent to admin and added to the global hub registry tree. Output is the based64 encoded hub registry object.

### setHubRegistryWithProof

```bash
npx ts-node src/cli/index.ts hub setHubRegistryWithProof <hubRegistryInBase64>
```

Set the registered hub registry along with its merkle proof to the database.

### start

```bash
npx ts-node src/cli/index.ts hub start [port] [hostname]
```

Make the hub server start to listen to users requests. `port` and `hostname` are optional. If options are not specified, defaults are `port=0` (assigned by OS) and `hostname=0.0.0.0` (listening to requests from everywhere). Press `Ctrl-C` to stop the server.

### getJoinedUsers

```bash
npx ts-node src/cli/index.ts hub getJoinedUsers
```

List the public keys of users who have joined the hub.

### removeUser

```bash
npx ts-node src/cli/index.ts hub removeUser [userPubkeyInBase64]
```

Remove the joined user.

### removeAllUsers

```bash
npx ts-node src/cli/index.ts hub removeAllUsers
```

Remove all joined users.

## User

### getKeypair

```bash
npx ts-node src/cli/index.ts user getKeypair
```

Output user's keypair.

### join

```bash
npx ts-node src/cli/index.ts user join <hostname> <port> <hubPubKeyInBase64>
```
Join hub `hubPubKeyInBase64` listening on the interface specified by `hostname` and `port`.

### search

```bash
npx ts-node src/cli/index.ts user search <hostname> <port> <targetPubkeyInBase64>
```

Search for the target user `targetPubkeyInBase64` through the hub listening on the interface specified by `hostname` and `port`. If the search is successful, the output is a Proof of Indirect Connection. Otherwise, the process exits with error code `1`.

### verifyProof

```bash
npx ts-node src/cli/index.ts user verifyProof <proofBase64Encoded>
```

Verify a Proof of Indirect Connection. `proofBase64Encoded` is the proof encoded in base64.

### getJoinedHubs

```bash
npx ts-node src/cli/index.ts user getJoinedHubs
```

Get detailed information of the hubs the user has joined.

## Example

Check out the testing scenario in [integration.test.ts](../../test/cli/integration.test.ts).

[deployed-contracts]: https://github.com/mhchia/blind-find/blob/8378a527f76fab56c23b8b6952252f9110a16873/src/cli/contractInfo.ts#L3
