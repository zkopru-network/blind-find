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

## Options

- `-d, --data-dir <dir>`: specifies the data directory where stores the configuration file `configs.yaml` file and the database.

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

Make the hub server start to listen to users requests. Press `Ctrl-C` to stop the server.

### getKeypair

```bash
npx ts-node src/cli/index.ts hub getKeypair
```

Output hub's keypair.


### listJoinedUsers

```bash
npx ts-node src/cli/index.ts hub listJoinedUsers
```

List the public keys of users who have joined the hub.


## User
### join

```bash
npx ts-node src/cli/index.ts user join <hostname> <port> <hubPubKeyInBase64>
```
Join a hub whose public key is `hubPubKeyInBase64` listening on the interface specified by `hostname` and `port`.


### search

```bash
npx ts-node src/cli/index.ts search <hostname> <port> <targetPubkeyInBase64>
```

Search the target user who public key is `targetPubkeyInBase64` through the hub listening on the interface specified by `hostname` and `port`. If the search is successful, the output is a Proof of Indirect Connection. Otherwise, the process exits with error code `1`.

### getKeypair

```bash
npx ts-node src/cli/index.ts user getKeypair
```

Output user's keypair.
        
