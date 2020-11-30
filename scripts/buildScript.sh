#!/bin/bash
# Usage: compile circom code and perform trusted setup
# Example: ./buildScript.sh xxx.circom

dir=`dirname $0`
projectRootDir="$dir/.."
build_dir="$projectRootDir/build"
mkdir -p $build_dir
circuit_filename=`basename $1`
circuit_name="${circuit_filename%%.*}"
r1cs_path="$build_dir/$circuit_name.r1cs"
wasm_path="$build_dir/$circuit_name.wasm"
pk_path="$build_dir/${circuit_name}_pk.json"
vk_path="$build_dir/${circuit_name}_vk.json"
pr_path="$build_dir/${circuit_name}.params"

# NODE_OPTIONS=--max-old-space-size=16384 ts-node $build_snark_script -i $circuit_path -j $r1cs_path -w $wasm_path -p $pk_path -v $vk_path -pr $pr_path -s $sol_out -vs $vs_sol_out
node $projectRootDir/node_modules/circom/cli.js $1 -r $r1cs_path -w $wasm_path
zkutil setup -c $r1cs_path -p $pr_path
zkutil export-keys -c $r1cs_path -p $pr_path -r $pk_path -v $vk_path
