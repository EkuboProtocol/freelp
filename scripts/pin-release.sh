#!/usr/bin/env bash
set -euo pipefail
export IPFS_PATH="${IPFS_PATH:-$PWD/.cache/ipfs}"
if [[ ! -f "$IPFS_PATH/config" ]]; then .cache/bin/ipfs init --profile=test; fi
# Offline imports never publish private provider records or contact public peers.
.cache/bin/ipfs --offline dag import release/site.car release/release.car
