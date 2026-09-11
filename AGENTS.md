# FreeLP development

FreeLP is prepared for open-source distribution under MIT. CI publishes verified npm releases from tags and IPFS previews from successful builds. Publish only the current build’s site CAR.

Use worktrees; keep main clean. New Solidity belongs in EkuboProtocol/evm-contracts. Import pinned compiled artifacts with `scripts/import-contracts.ts` and record their source commit in `artifacts/source.json`.

The application uses only configured RPC endpoints and injected wallets. Core, FreeLP and FreeLPDataFetcher addresses are fixed by the build; never expose protocol address overrides. Use viem chains and defaults. Enable 11 chosen mainnets initially; persist explicit RPC overrides. No hosted metadata, token APIs, indexers, relays, analytics, fonts, or transaction services. All position/NFT data is on-chain. Distribute the static app as @ekubo/freelp, runnable with bunx or npx. Do not add attestations or compiled launchers.

Use black/white styling and system fonts. Retain required license and protocol identifiers.

Use plain English JSX and strings for user-facing copy. No translation framework or catalogs.

Run lint, typecheck, unit tests, production build, accessibility checks, and Lighthouse thresholds. Exercise changed transaction flows with the local-chain browser tests. Complexity is capped at 10; simplify functions rather than raising the limit or adding suppressions.

Terms are informational: no acceptance gate, consent storage, or terms version. Preserve wallet confirmation, simulation, chain/account checks, and transaction locking. No executable runtime updates. Preserve reproducible inputs and per-commit IPFS records.

Every successful branch/tag build pins on the DigitalOcean node and attaches its gateway URL to the commit status and Actions summary. Keep FREELP_PUBLIC_RELEASE=false until stable IPNS publication is authorized separately.

The deploy.yml publish-npm job uses npm trusted publishing and the npm environment. Trusted publishing is configured; FREELP_NPM_PUBLISH=true. Do not add npm write tokens.
