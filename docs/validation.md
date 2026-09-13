# Validation

The release workflow runs lint, TypeScript, unit tests, the production build, local-chain browser lifecycles, accessibility and Lighthouse checks, packaged-app checks, and isolated IPFS gateway verification before npm publication.

The application uses fixed Core, FreeLP, and FreeLPDataFetcher addresses from the pinned artifacts in `artifacts/`. Deployment checks require nonempty code at those addresses. Artifact provenance records the source commit in `artifacts/source.json`; contract review history is maintained with the separate Solidity changes.

Unit coverage includes local deposit math and EVM rounding, amount and range validation, URL snapping, chain settings, token deduplication, wallet batching, and distribution boundaries. Browser tests cover creation, deposits, withdrawals, fee collection, deterministic deployment, network settings, token import, and informational terms without an acceptance gate.

The npm tarball is installed and served through both bunx and npx from outside the source checkout. CI also verifies the immutable IPFS CAR through a local gateway. The tested package, CAR, deployment descriptor, and generated UX/accessibility/Lighthouse reports are uploaded as Actions artifacts, including when browser checks fail; release pages contain notes only.

Historical verification:

- [v0.1.1 tagged CI](https://github.com/EkuboProtocol/freelp/actions/runs/34543104970) passed the application and distribution checks.
- [IPNS rehearsal](https://github.com/EkuboProtocol/freelp/actions/runs/34543343197) verified signing and resolution offline.
- [SDK, multichain, and wallet batch CI](https://github.com/EkuboProtocol/freelp/actions/runs/34626282667) passed the expanded checks before the English-only cleanup.

Current release evidence is available in GitHub Actions. Performance scores describe the measured run and may vary between machines.
