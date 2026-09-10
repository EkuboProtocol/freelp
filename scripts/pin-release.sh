#!/usr/bin/env bash
set -euo pipefail
export IPFS_PATH="${IPFS_PATH:-$PWD/.cache/ipfs}"
if [[ ! -f "$IPFS_PATH/config" ]]; then .cache/bin/ipfs init --profile=test; fi
# Offline imports never publish private provider records or contact public peers.
.cache/bin/ipfs --offline dag import release/site.car release/release.car
# Public distribution is enabled explicitly only after the repository is public.
if [[ "${FREELP_PUBLIC_RELEASE:-false}" == true ]]; then
  if [[ -z "${FREELP_PIN_API:-}" ]]; then
    echo 'Public deployment requires a project-controlled IPFS pin API.' >&2
    exit 1
  fi
  curl --fail --silent --show-error -X POST "$FREELP_PIN_API/api/v0/dag/import?pin-roots=true" -F file=@release/release.car
fi
