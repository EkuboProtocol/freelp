# Launch handoff

FreeLP is currently private. This checklist describes the later public launch; it does not authorize changing repository visibility or publishing private content now.

## Ready-to-review artifacts

- Interface and launcher: `moodysalem/freelp`, private. `README.md` documents source builds, launcher bootstrap, RPC configuration, IPFS restoration, and licenses.
- Contracts: `EkuboProtocol/evm-contracts` PR #372, separate from complexity tooling. `artifacts/source.json` pins the imported contract source and compiler settings. Review the contract PR before production use.
- Per-commit releases retain `descriptor.json`, `application.json`, `provenance.json`, both CARs, both CIDs, and compiled launchers. `docs/validation.md` records actual checks.
- The first private versioned release is `v0.0.1`. It exercises stable-release discovery; it is not a public launch announcement.

## Independent bootstrap

Obtain the official source checkout and its expected commit through a trusted channel. Install pinned Bun and dependencies using the lockfile. From that trusted checkout, authenticate a downloaded launcher before executing it:

```sh
bun scripts/verify-launcher.ts /path/to/release /path/to/release/freelp-linux-x64 private
```

Omit `private` for public Sigstore releases. Use the matching artifact name for the supported platform. This verifies the descriptor's repository/CI evidence and the binary digest. A verifier downloaded alongside untrusted bytes cannot establish trust by itself. Alternatively build the launcher from the trusted checkout using `bun run build:cli`.

Run an authenticated private launcher with `--private-build`; use `--offline` to reverify its cached application without update discovery. Public launchers default to public provenance. The CLI never automatically replaces itself or trusts roots supplied by the candidate app.

## Before public announcement

1. Review the final source, notices, contract PR, runtime size, CI results, and validation record. Confirm there are no secrets in source history, release assets, or logs. The one initial root commit contains the reduced interface; later commits are normal development history.
2. Decide which prelaunch releases and historical CIDs are intended for public access. Repository visibility also changes access to its existing releases. Preserve anything that must remain private separately before changing visibility.
3. Once authorized to launch, make the repository public and push a new stable version tag. Do not relabel the old private issuance proof as a public attestation.
4. Require that tag's complete CI to pass, including public Sigstore generation, independent CLI verification through the isolated gateway, direct public IPFS seeding, and release retention. The real public provenance/DHT steps are deliberately not exercised against private app content before this point.
5. Independently verify the public CLI from the trusted checkout, then verify its default latest-release path and explicit release CID. Confirm the release's site CID reproduces from the pinned source build. Only then announce that version.
6. Retain `release.car` on any volunteer Kubo nodes for long-lived IPFS service. CI seeds temporarily; no project pin API or application server is required. GitHub releases retain restorable CARs, and local CLI caches keep working independently of GitHub. Content addressing alone does not guarantee permanent availability.

## Using the deployed app

Use an injected EVM wallet. In Settings, choose a free RPC or your own node, the matching chain ID, and compatible Core/manager addresses. Test the RPC and verify contract bytecode. All authoritative LP data comes from contract reads; there are no indexer, token API, price API, or metadata-service requirements.

The Deploy page can create a manager against an existing compatible Core, or deploy a fresh Core and then a manager. Successful deployment addresses are saved separately, so a failed second deployment can be retried against the existing Core. Deployment is ownerless; the app adds no administrative key or application fee. Network gas and protocol pool fees still apply.

Accept the current terms for the connected account before any approval, LP transaction, or deployment. Create a pool/position using prices, raw ticks, or full range; manage existing positions through add, collect, withdraw, transfer, and empty-position burn. Wallet confirmation remains separate from accepting terms.

If an RPC fails, change it in Settings. If the wallet account or chain changes, reconnect and review the active account. If update discovery fails, explicitly use a previously verified offline release; the launcher never silently treats it as the latest version.
