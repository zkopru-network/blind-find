<p align="center">
  <a href="https://github.com/mhchia/blind-find/actions?workflow=nodejs"><img alt="GitHub Actions status" src="https://github.com/mhchia/blind-find/workflows/nodejs/badge.svg"></a>
</p>

# Blind Find
*Blind Find* is a peer-to-peer network allowing private peer search proposed by Barry Whitehat and Kobi Gurkan. For the detail specification, please read the [post][blind-find-ethresearch] on ethresearch.

## Install

Since we're using [`zkutil`](https://github.com/poma/zkutil) to perform proof generation/verification and other stuffs, first we need to ensure `cargo` is installed and install `zkutil` with `installZkutil.sh`.

```bash
./scripts/installZkutil.sh
source $HOME/.cargo/env
```

Clone the repo.
```bash
git clone git@github.com:mhchia/blind-find.git
```

Install dependencies.
```bash
cd blind-find
npm install
```

Compile circuits and generate necessary parameters.
```bash
npm run build_all_circuits
```

## Command Line Interface (CLI)

Read [CLI document](src/cli/README.md) for the usage.

## Test

Run all tests.

```bash
npm run test
```

## Testnet
Currently we have a Blind Find v1 [contract](https://kovan.etherscan.io/address/0xe57881d655309c9a20f469a95564beaeb93ce73a#code) deployed on Kovan. Also, a hub is available for testing with the following settings:
- Hostname: `blindfind.mhchia.com`
- Port: `5566`
- hubPubkey: `WyI5NzA4ODY0Mjc4NjQxNzIwMjA3MzQwNjQwODk5MDQ5MDU0MjM5MTgwNDY2ODQzNzU0OTUyMzAxMTc1MzgxNTQ4NTMyMDc0MTc4NDM4IiwiMjEwOTg3MjgxMDM0MDU0ODg1NjYyMTY3MjI3OTI3NDExMzc3MzcxMzgxODg0MDAxOTUzMzY0NjE1MTQ2NjA5MDkxMTQyOTkzNDcyNzEiXQ==`

[blind-find-ethresearch]: https://ethresear.ch/t/blind-find-private-social-network-search/6988
