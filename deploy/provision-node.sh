#!/usr/bin/env bash
set -euo pipefail
export IPFS_TELEMETRY=off DO_NOT_TRACK=1
# Run as root on the selected Linux amd64 host, with this repository as cwd.
[[ $(id -u) == 0 && $(uname -m) == x86_64 ]]
if ! id freelp >/dev/null 2>&1; then useradd --create-home --shell /bin/bash freelp; fi
mkdir -p /home/freelp/.local/lib/freelp /home/freelp/.local/share/freelp/releases
bash scripts/install-ipfs.sh
install -m 755 .cache/bin/ipfs /home/freelp/.local/lib/freelp/ipfs
install -m 755 deploy/receive-release.sh /home/freelp/.local/lib/freelp/receive-release
chown -R freelp:freelp /home/freelp/.local
ipfs=(runuser -u freelp -- env IPFS_PATH=/home/freelp/.local/share/freelp/ipfs /home/freelp/.local/lib/freelp/ipfs)
if [[ ! -f /home/freelp/.local/share/freelp/ipfs/config ]]; then
  "${ipfs[@]}" init --profile=server,lowpower
  "${ipfs[@]}" config Addresses.API /ip4/127.0.0.1/tcp/15002
  "${ipfs[@]}" config Addresses.Gateway /ip4/127.0.0.1/tcp/18082
  "${ipfs[@]}" config Routing.Type dhtclient
  "${ipfs[@]}" config Datastore.StorageMax 4GB
fi
install -m 644 deploy/freelp-ipfs.service /etc/systemd/system/freelp-ipfs.service
systemctl daemon-reload
systemctl enable --now freelp-ipfs.service
printf 'Node installed. Allow inbound TCP/UDP 4001 and SSH in its cloud firewall. Keep API 15002 and gateway 18082 loopback-only.\n'
