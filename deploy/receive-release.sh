#!/usr/bin/env bash
set -euo pipefail
# Forced SSH command: this key can submit CARs, never run arbitrary shell commands.
[[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^freelp-pin\ ([a-f0-9]{40})\ (bafy[a-z2-7]{55})$ ]]
commit=${BASH_REMATCH[1]}
cid=${BASH_REMATCH[2]}
export IPFS_PATH="$HOME/.local/share/freelp/ipfs"
release_dir="$HOME/.local/share/freelp/releases"
mkdir -p "$release_dir"
umask 077
incoming=$(mktemp "$release_dir/incoming-XXXXXXXX")
trap 'rm -f "$incoming"' EXIT
head -c 20971521 > "$incoming"
[[ $(wc -c < "$incoming") -le 20971520 ]]
if [[ -f "$release_dir/$commit.car" ]]; then cmp "$incoming" "$release_dir/$commit.car"; fi
"$HOME/.local/lib/freelp/ipfs" dag import "$incoming"
"$HOME/.local/lib/freelp/ipfs" pin ls "$cid"
mv "$incoming" "$release_dir/$commit.car"
echo "Retained $cid"
