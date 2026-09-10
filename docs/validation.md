# Validation record — npm and multichain revision

Development remains private. These checks are evidence of tested behavior, not public launch approval.

## Contracts

Pinned source: EkuboProtocol/evm-contracts commit 577c33f8df83c7af7dcd3d3d17fbf867710f0f29, PR #372, ready for review. The PR contains only FreeLP sources, packed types, on-chain metadata, tests, documentation, and gas snapshots; unrelated complexity tooling is excluded. Previously completed contract checks include 16 targeted tests with 10,000 fuzz runs and a 24,293-byte manager runtime.

The UI bundles Core, FreeLP, QuoteDataFetcher, CoreDataFetcher, and TokenDataFetcher from that build. Runtime verification includes immutable Core bindings. Live RPC reads on 2026-09-10 matched the bundled QuoteDataFetcher runtime on Robinhood Chain, Base, Arbitrum, and Ethereum. Core bytecode matched on Robinhood, Base, and Arbitrum. Cloudflare returned errors for contract-code reads, so Ethereum keeps the working PublicNode default; users may replace it.

## Application and distribution

- Lint, TypeScript, production build, and 15 unit tests pass. Unit coverage includes settlement safeguards, terms checks at transaction entry, exact amounts/ranges, sorted on-chain enumeration, immutable runtime checks, content CIDs/server boundaries, private IPFS publication guards, and liquidity reconstruction across initialized ticks.
- Seven local-chain browser tests cover standard/native/nonstandard-token LP lifecycles, Core/FreeLP/data-fetcher deployment from the UI, pool discovery and nonzero liquidity bars, independent network configurations, bundled token selection and ordering, and terms behavior with account/storage changes.
- The npm tarball installs offline with npm and starts via `bun x --no-install @ekubo/freelp` from a temporary directory without the source checkout. Its bundled JavaScript is served and arbitrary filesystem paths return 404. No runtime dependencies or second application download are required.
- Desktop and mobile rendering were inspected. Token amounts and selectors are grouped together; raw addresses and custom fee/slippage inputs are under advanced settings.
- Old compiled binaries, attestation verification, proof packaging, and their obsolete tests have been removed. Historical v0.0.2 validation remains in git history; it does not describe the current npm distribution.

CI repeats these checks, tests the site's path and subdomain IPFS gateway layouts with external requests blocked, and retains per-commit CAR/npm artifacts in private GitHub releases. Public npm publication and public IPFS seeding have not been performed. Persistent public availability still requires retained copies and usable RPC endpoints.
