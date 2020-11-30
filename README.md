<p align="center">
  <a href="https://github.com/mhchia/blind-find/actions?workflow=nodejs"><img alt="GitHub Actions status" src="https://github.com/mhchia/blind-find/workflows/nodejs/badge.svg"></a>
</p>

# Blind Find
*Blind Find* is a peer-to-peer network allowing private peer search proposed by Barry Whitehat and Kobi Gurkan. For the detail specification, please read the [post][blind-find-ethresearch] on ethresearch.

## Install
```bash
npm install
```

### Install zkutil

Run [installZkutil.sh](scripts/installZkutil.sh) to install zkutil.

```bash
./scripts/installZkutil.sh
```

## Test

Build circuits before running tests.
```bash
npm run build_all_circuits
```

Run all tests.

```bash
npm run test
```

[blind-find-ethresearch]: https://ethresear.ch/t/blind-find-private-social-network-search/6988
