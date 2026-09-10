#!/usr/bin/env bash
set -euo pipefail
export IPFS_TELEMETRY=off DO_NOT_TRACK=1
# An independent, serialized publisher. No code is read from release archives.
repo=EkuboProtocol/freelp
mode=${FREELP_IPNS_DRY_RUN:-true}
if [[ "$mode" != true ]]; then
  [[ "${FREELP_PUBLIC_RELEASE:-false}" == true ]]
  [[ "$(gh repo view "$repo" --json isPrivate --jq .isPrivate)" == false ]]
fi
tag=${FREELP_RELEASE_TAG:-}
if [[ -z "$tag" ]]; then tag=$(gh release view --repo "$repo" --json tagName --jq .tagName); fi
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
mkdir -p .cache/ipns-release
release_dir="$PWD/.cache/ipns-release"
gh release view "$tag" --repo "$repo" --json isDraft,isPrerelease --jq 'select(.isDraft == false and .isPrerelease == false)' | jq -e . >/dev/null
gh release download "$tag" --repo "$repo" --pattern site.car --pattern deployment.json --dir "$release_dir" --clobber
commit=$(gh api "repos/$repo/commits/$tag" --jq .sha)
[[ "$commit" =~ ^[a-f0-9]{40}$ ]]
jq -e --arg repo "$repo" --arg commit "$commit" '.repository == $repo and .commit == $commit' "$release_dir/deployment.json" >/dev/null
site_cid=$(jq -r .siteCid "$release_dir/deployment.json")
[[ "$site_cid" =~ ^bafy[a-z2-7]{55}$ ]]
# Refuse an old workflow finishing after a newer stable release.
latest=$(gh release view --repo "$repo" --json tagName --jq .tagName)
[[ "$tag" == "$latest" ]]
if [[ "$mode" != true ]]; then bash scripts/retain-release.sh "$release_dir"; fi
export IPFS_PATH
IPFS_PATH=$(mktemp -d "$PWD/.cache/ipns-node-XXXXXXXX")
ipfs_bin="$PWD/.cache/bin/ipfs"
"$ipfs_bin" init --profile=test >/dev/null
"$ipfs_bin" config Addresses.API /ip4/127.0.0.1/tcp/0
"$ipfs_bin" config --json Addresses.Gateway '[]'
"$ipfs_bin" config Routing.Type dht
"$ipfs_bin" --offline dag import "$release_dir/site.car"
"$ipfs_bin" --offline block stat "$site_cid" >/dev/null
umask 077
keyfile="$IPFS_PATH/publishing-key"
printf '%s' "${FREELP_IPNS_KEY:?Missing publishing key}" | base64 --decode > "$keyfile"
unset FREELP_IPNS_KEY
name=$("$ipfs_bin" key import freelp "$keyfile" --ipns-base=base36)
rm "$keyfile"
[[ "$name" == "${FREELP_IPNS_NAME:?Missing expected IPNS name}" ]]
sequence=$(( $(date +%s) * 1000 + ${GITHUB_RUN_ATTEMPT:-1} ))
if [[ "$mode" == true ]]; then
  "$ipfs_bin" --offline name publish --allow-offline --key=freelp --sequence="$sequence" --lifetime=168h --ttl=5m "/ipfs/$site_cid"
  [[ "$("$ipfs_bin" --offline name resolve --nocache "$name")" == "/ipfs/$site_cid" ]]
  echo 'Verified IPNS signing and resolution offline. Nothing was publicly published.'
else
  # The test profile intentionally has no peers. Enable public DHT discovery
  # only after the public-release guards and persistent pin have succeeded.
  "$ipfs_bin" config --bool AutoConf.Enabled true
  "$ipfs_bin" config --json Bootstrap '["auto"]'
  "$ipfs_bin" config --bool Routing.LoopbackAddressesOnLanDHT false
  "$ipfs_bin" daemon > "$IPFS_PATH/daemon.log" 2>&1 &
  for attempt in {1..30}; do
    if [[ -f "$IPFS_PATH/api" ]] && "$ipfs_bin" id >/dev/null 2>&1; then break; fi
    sleep 1
  done
  "$ipfs_bin" --timeout=3m name publish --key=freelp --sequence="$sequence" --lifetime=168h --ttl=5m "/ipfs/$site_cid"
  [[ "$("$ipfs_bin" --timeout=2m name resolve --nocache "$name")" == "/ipfs/$site_cid" ]]
fi
jq -n --arg tag "$tag" --arg commit "$commit" --arg cid "$site_cid" --arg name "$name" --argjson dryRun "$mode" '{tag:$tag,commit:$commit,siteCid:$cid,ipnsName:$name,dryRun:$dryRun}' > "$release_dir/ipns-deployment.json"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf 'Release: %s\n\nIPFS: `ipfs://%s`\n\nIPNS: `ipns://%s`\n\nOffline rehearsal: %s\n' "$tag" "$site_cid" "$name" "$mode" >> "$GITHUB_STEP_SUMMARY"
fi
