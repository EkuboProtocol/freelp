#!/usr/bin/env bash
set -euo pipefail
version=v0.43.0
archive=kubo_${version}_linux-amd64.tar.gz
expected=6af21cd24a307d94326807b3d3827064c74fb7122f83b6940af250e6ae40da250e0ec0e1f3551256b78cd204623ed56c32ce735bbe28bdcc787b36943c52458a
task_tmp=$(mktemp -d)
trap 'rm -rf "$task_tmp"' EXIT
curl --fail --location --silent --show-error "https://github.com/ipfs/kubo/releases/download/${version}/${archive}" -o "$task_tmp/$archive"
actual=$(sha512sum "$task_tmp/$archive")
[[ "${actual%% *}" == "$expected" ]]
tar -xzf "$task_tmp/$archive" -C "$task_tmp"
mkdir -p .cache/bin
install -m 755 "$task_tmp/kubo/ipfs" .cache/bin/ipfs
