# Distribution and release infrastructure

## User entry points

Use https://freelp.ekubo.org/ directly: a Cloudflare DNSLink gateway serving the published stable IPNS name. Otherwise run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`, which serve the bundled app locally and open a browser (Node 22+; the Bun command also requires Bun). Pin a version with `@ekubo/freelp@0.1.1`.

GitHub releases contain notes only. The immutable alternative is `ipfs://<siteCid>` from the release's Actions summary. The app still needs a browser-accessible configured RPC endpoint; gateways and npm supply static files and never proxy RPC or wallet traffic.

The stable name is `ipns://k51qzi5uqu5dhvrw6m3hzjr4c4hgohescj5ge8krqugbmgr44avgh35s2gachm`, published and renewed by automation. IPNS is a mutable publisher-controlled pointer; a versioned npm package or immutable CID keeps a chosen release.

## Release jobs

`deploy.yml` checks every pushed branch commit and tag: lint, typecheck, unit tests, production build, browser lifecycles, accessibility/Lighthouse, packaged-app check, and isolated IPFS gateway verification. It pins that build's CAR on the persistent node, links the preview to the commit, and retains the tested tarball, CAR, deployment descriptor, and reports as Actions artifacts for 90 days. Tagged builds create a notes-only GitHub release and publish to npm through trusted publishing. Fork PRs do not run this workflow.

`ipns.yml` is separate and serialized. It runs after a successful tagged build, manually, or every 12 hours, and only for public releases. It verifies the tag, commit, CID shape, and latest-release selection, re-pins the CAR, then signs a seven-day IPNS record with a five-minute TTL. Failed pinning leaves the current record untouched. A manual dry run signs and resolves offline without publishing.

## Allocated resources

- DigitalOcean project `FreeLP`, droplet `freelp-ipfs-nyc3` (`45.55.163.218`, basic 1 vCPU/512 MiB, $4/month). Kubo 0.43.0, low-power profile, client DHT routing. Gateway/admin ports bind to loopback; firewall opens SSH and 4001.
- IPNS signing key and deployment SSH key in GitHub Actions secrets, backed up in the authorized 1Password Agent vault with the node-admin key. No key material belongs in this repository. The deploy key is restricted to `receive-release.sh`, which only accepts a bounded CAR and confirms its pin.

GitHub retains CARs for 90 days, so the node can be rebuilt and content re-pinned from Actions artifacts. Users can pin any release CAR elsewhere.

## Recovery

Recover the server-admin key from the Agent vault, reinstall Kubo, user/service, and the restricted receiver from `deploy/`, and reimport the release CARs. Keep the existing IPNS signing key to preserve the stable address. Renew builds before their 90-day artifact expiry so scheduled IPNS publication continues.
