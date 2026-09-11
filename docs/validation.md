# Validation

The release workflow runs lint, TypeScript, unit tests, the production build, local-chain browser lifecycles, accessibility and Lighthouse checks, packaged-app checks, and isolated IPFS gateway verification before npm publication.

The application uses fixed Core, FreeLP, and FreeLPDataFetcher addresses from the pinned artifacts in `artifacts/`. Deployment checks require nonempty code at those addresses. Contract source and review history are recorded in `artifacts/source.json`; Solidity changes remain separate from the interface repository.

Unit coverage includes local deposit math and EVM rounding, amount and range validation, URL snapping, chain settings, token deduplication, wallet batching, and distribution boundaries. Browser tests cover creation, deposits, withdrawals, fee collection, deterministic deployment, network settings, token import, and informational terms without an acceptance gate.

The npm tarball is installed and served through both bunx and npx from outside the source checkout. CI also verifies path and subdomain IPFS gateway layouts. Verified package and CAR files are retained as Actions artifacts; release pages contain notes only.

Historical verification:

- [v0.1.1 tagged CI](https://github.com/EkuboProtocol/freelp/actions/runs/34543104970) passed the application and distribution checks.
- [IPNS rehearsal](https://github.com/EkuboProtocol/freelp/actions/runs/34543343197) verified signing and resolution offline.
- [SDK, multichain, and wallet batch CI](https://github.com/EkuboProtocol/freelp/actions/runs/34626282667) passed the expanded checks before the English-only cleanup.

Current release evidence is available in GitHub Actions. Performance scores describe the measured run and may vary between machines.
