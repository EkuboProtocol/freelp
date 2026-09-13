# Distribution and release infrastructure

## User entry points

After npm publication, recommend `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`. Both serve the application bundled in the installed package and open a browser. The launcher requires Node 22+ for either command; npx users do not need Bun. Pin a version with `@ekubo/freelp@0.1.1`. To pass options explicitly with npx: `npx -- @ekubo/freelp@latest --no-browser --port 4173`.

GitHub releases contain release notes only. CI retains the tested npm tarball, deployment descriptor, CAR, and UX/accessibility/Lighthouse test reports as Actions artifacts. The immutable alternative is `ipfs://<siteCid>`, or a local Kubo gateway. The app still needs a browser-accessible configured RPC endpoint; IPFS supplies static files and does not proxy RPC or wallet traffic.

The allocated stable name is `ipns://k51qzi5uqu5dhvrw6m3hzjr4c4hgohescj5ge8krqugbmgr44avgh35s2gachm`. Gateway form: `https://k51qzi5uqu5dhvrw6m3hzjr4c4hgohescj5ge8krqugbmgr44avgh35s2gachm.ipns.dweb.link/`. This name is reserved; stable IPNS publication is disabled. IPNS is a mutable publisher-controlled pointer; a versioned npm package or immutable CID keeps a chosen release.

## Release jobs

`deploy.yml` checks every pushed branch commit and tag, builds the npm package and CAR, runs accessibility/Lighthouse and browser tests, and retains verified build inputs and generated reports in Actions artifacts for 90 days; GitHub releases contain notes only. After verification, it uploads that build’s CAR to the persistent node and confirms its pin. PRs from forks do not run this publishing workflow.

`ipns.yml` is separate and serialized. It runs after a successful tagged build, manually, or every 12 hours to renew the latest stable record. It checks repository privacy, stable release status, tag/commit correspondence, CID shape, and latest-release selection. It sends the CAR to the persistent node and confirms the pin before signing a seven-day IPNS record with a five-minute cache TTL. Failed pinning leaves the current IPNS record untouched. Timestamp-based sequence numbers prevent resetting the sequence on a fresh runner. The previous record remains valid during a job failure; scheduled publication must continue for long-term IPNS resolution.

A manual dry run uses verified Actions artifacts. It imports the CAR, signs the record, and resolves it entirely offline in a new isolated Kubo repository. It never contacts the pinning host or public IPFS peers. This verifies signing without publication.

## Allocated resources

- DigitalOcean project `FreeLP`, ID `51f7c8e3-b4b9-4400-bef3-1bda3d0cded3`.
- Droplet `freelp-ipfs-nyc3`, ID `599479827`, IPv4 `45.55.163.218`, Debian 13, NYC3.
- Smallest shared Basic plan `s-1vcpu-512mb-10gb`: 1 vCPU, 512 MiB RAM, 10 GiB disk, $4/month base price. This hosting cost is separate from the fee-free app. No paid backup or attached volume was allocated.
- Cloud firewall `freelp-ipfs`, ID `cee1ca54-21c7-49cf-b823-adb1221bbb3f`: inbound SSH and IPFS TCP/UDP 4001. IPFS admin API 15002 and gateway 18082 bind only to loopback.
- Dedicated `freelp` OS user. Kubo 0.43.0 is checked against its pinned SHA-512 checksum, uses the low-power profile, client DHT routing, a 300 MiB Go memory target, a 384 MiB service cap, and 512 MiB swap.
- IPNS signing key and deployment SSH key are in GitHub Actions secrets, backed up as documents in the authorized 1Password Agent vault. The separate node-admin key is backed up there too. No key material belongs in this repository.

CI's SSH key is restricted to `receive-release.sh`: it accepts a bounded CAR, validates commit/CID arguments, preserves existing content for a commit, imports and confirms its pin. It cannot execute arbitrary commands or administer the server. The SSH host key is pinned independently of the deployment key.

The app itself still uses only wallet/RPC connections. The Droplet provides IPFS blocks and does not proxy transactions, index positions, or hold wallet keys. GitHub retains CARs for recovery if the node is lost; users can pin the same CAR elsewhere.

## Recovery and launch

Recover the server-admin key from the Agent vault to administer this one Droplet. Reinstall the pinned Kubo binary, dedicated user/service, and restricted receiver from `deploy/`. Reimport authorized public release CARs to restore content. Keep the existing IPNS signing key to preserve the stable address.

IPNS automation retrieves its verified build from Actions artifacts. Those expire after 90 days; renew the build before expiration to continue scheduled IPNS publication. Stable IPNS publication remains disabled.
