#!/usr/bin/env bash
set -euo pipefail
# The stable pointer must never advance before a durable node has pinned the CAR.
release_dir=${1:?Supply release directory}
: "${FREELP_PIN_HOST:?Configure the persistent IPFS host}"
: "${FREELP_PIN_SSH_KEY:?Configure the dedicated deployment SSH key}"
: "${FREELP_PIN_HOST_KEY:?Pin the host SSH public key}"
[[ "$FREELP_PIN_HOST" =~ ^[a-zA-Z0-9._@-]+$ && "$FREELP_PIN_HOST" != -* ]]
commit=$(jq -r .commit "$release_dir/deployment.json")
cid=$(jq -r .siteCid "$release_dir/deployment.json")
[[ "$commit" =~ ^[a-f0-9]{40}$ && "$cid" =~ ^bafy[a-z2-7]{55}$ ]]
umask 077
ssh_dir=$(mktemp -d)
trap 'rm -rf "$ssh_dir"' EXIT
printf '%s\n' "$FREELP_PIN_SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$FREELP_PIN_HOST_KEY" > "$ssh_dir/known_hosts"
options=(-i "$ssh_dir/key" -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts")
ssh "${options[@]}" "$FREELP_PIN_HOST" "freelp-pin $commit $cid" < "$release_dir/site.car"
