# Blind Find CLI

## Command Line Interface (CLI)

`src/cli/index.ts` provides CLI. There are 4 subcommands: [general](#General), [admin](#Admin), [hub](#Hub), and [user](#User). For general users, only `general` and `user` are useful in most cases. Consult available commands with `--help`.

```bash
% npx ts-node src/cli/index.ts --help
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

### General

Provides general utility functions.

#### genKeypair

```bash
npx ts-node src/cli/index.ts general genKeypair
```

Generate a BlindFind keypair. Output is a valid blind find keypair.

<!-- 
**Example**
```bash
$ npx ts-node src/cli/index.ts general genKeypair
{
        "privKey": "privKey",
        "pubKey": [
                "pubKeyXCoordinate",
                "pubKeyYCoordinate"
        ],
        "pubKeyInBase64": "pubKeyInBase64"
}
``` -->

### Admin

#### addHub

```bash
addHub <hubRegistryInBase64>
```

Add a hub registry to admin's merkle tree. Output is the hub registry along with its merkle proof.


### Hub

#### createHubRegistry

```bash
hub createHubRegistry
```

Create a hub registry, by signing a `RegisterHub` message with its keypair. To be registered as a valid hub, this hub registry must be sent to admin and added to the global hub registry tree. Output is the based64 encoded hub registry object.

#### setHubRegistryWithProof

```bash
hub setHubRegistryWithProof <hubRegistryInBase64>
```

Set the registered hub registry along with its merkle proof to the database.

#### start

```bash
hub start [port] [hostname]
```

Make the hub server start to listen to users requests. Press `Ctrl-C` to stop the server.


#### getKeypair

```bash
hub getKeypair
```

Output hub's keypair.


#### listJoinedUsers

```bash
hub listJoinedUsers
```

List the public keys of users who have joined the hub.


### User
#### join

```bash
user join <hostname> <port> <hubPubKeyInBase64>
```
Join a hub whose public key is `hubPubKeyInBase64` listening on the interface specified by `hostname` and `port`.


#### `search`

```bash
search <hostname> <port> <targetPubkeyInBase64>
```

Search the target user who public key is `targetPubkeyInBase64` through the hub listening on the interface specified by `hostname` and `port`. If the search is successful, the output is a Proof of Indirect Connection. Otherwise, the process exits with error code `1`.

#### `getKeypair`

```bash
user getKeypair
```

Output user's keypair.
        

## Testnet
- kovan
    - Deployed the contract on Kovan testnet
        - [etherscan](https://kovan.etherscan.io/address/0xe57881d655309c9a20f469a95564beaeb93ce73a#code)
- Public Hub
    - Hostname: `blindfind.mhchia.com`
    - Port: `5566`
    - hubPubkey: `WyI5NzA4ODY0Mjc4NjQxNzIwMjA3MzQwNjQwODk5MDQ5MDU0MjM5MTgwNDY2ODQzNzU0OTUyMzAxMTc1MzgxNTQ4NTMyMDc0MTc4NDM4IiwiMjEwOTg3MjgxMDM0MDU0ODg1NjYyMTY3MjI3OTI3NDExMzc3MzcxMzgxODg0MDAxOTUzMzY0NjE1MTQ2NjA5MDkxMTQyOTkzNDcyNzEiXQ==`

