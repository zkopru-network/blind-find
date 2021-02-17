#!/bin/bash

CARGO_BIN_DIR=~/.cargo/bin
CARGO_PATH=$CARGO_BIN_DIR/cargo
ZKUTIL_PATH=$CARGO_BIN_DIR/zkutil

which cargo > /dev/null
if [ "$?" != "0" ]
then
    echo "Cargo is not installed. Installing...";
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi

if [ ! -f "$ZKUTIL_PATH" ]
then
    # Install zkutil
    echo "zkutil is not installed. Installing...";
    $CARGO_PATH install zkutil --version 0.3.2 && zkutil --help
fi
