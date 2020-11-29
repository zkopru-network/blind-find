#!/bin/bash

which cargo > /dev/null
if [ "$?" != "0" ]
then
    # Install rust and cargo
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi

which zkutil > /dev/null
if [ "$?" != "0" ]
then
    # Install zkutil.
    cargo install zkutil --version 0.3.2 && zkutil --help
fi
