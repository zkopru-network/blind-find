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
Install rust if you don't have it.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Install [`zkutil`](https://github.com/poma/zkutil)@`0.3.2` with `cargo`.

```bash
cargo install zkutil --version 0.3.2 && zkutil --help
```

## Test

Build circuits before running tests.
```bash
npm run build_circuits
```

Run all tests.

```bash
npm run test
```

[blind-find-ethresearch]: https://ethresear.ch/t/blind-find-private-social-network-search/6988
