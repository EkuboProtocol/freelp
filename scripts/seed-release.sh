#!/usr/bin/env bash
set -euo pipefail
# This script must never expose the private verification node or its old blockstore.
if [[ "${FREELP_PUBLIC_RELEASE:-false}" != true ]]; then
  echo 'Public IPFS seeding is disabled for private development.' >&2
  exit 1
fi
mkdir -p .cache
export IPFS_PATH
IPFS_PATH=$(mktemp -d "$PWD/.cache/ipfs-public-XXXXXXXX")
ipfs_bin="$PWD/.cache/bin/ipfs"
"$ipfs_bin" init
"$ipfs_bin" config Addresses.API /ip4/127.0.0.1/tcp/0
"$ipfs_bin" config --json Addresses.Gateway '[]'
"$ipfs_bin" config Routing.Type dht
"$ipfs_bin" config --bool Provide.DHT.SweepEnabled false
"$ipfs_bin" --offline dag import release/site.car
"$ipfs_bin" daemon > "$IPFS_PATH/daemon.log" 2>&1 &
for attempt in {1..30}; do
  if [[ -f "$IPFS_PATH/api" ]] && "$ipfs_bin" id > /dev/null 2>&1; then break; fi
  sleep 1
done
[[ -f "$IPFS_PATH/api" ]]
"$ipfs_bin" id > /dev/null
site_cid=$(bun -e 'console.log((await Bun.file("release/deployment.json").json()).siteCid)')
# Kubo is pinned. This compatibility command waits for DHT publication rather
# than only queuing provides; no hosted pinning API or project server is used.
"$ipfs_bin" --timeout=2m routing provide "$site_cid"
echo "Seeded $site_cid from this CI job. Retain site.car on any node for lasting availability."
# The CI runner owns this temporary daemon and removes it when the job ends.
