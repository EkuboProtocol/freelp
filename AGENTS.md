# FreeLP development

Keep the source repository and npm package private until launch readiness. The user authorized public IPFS previews of every successful CI build. Publish only that build’s site CAR; never bring a historical private IPFS blockstore online. The EVM contracts PR may be public.

Edit in a dedicated worktree; keep the default checkout clean. New Solidity belongs in EkuboProtocol/evm-contracts. Import pinned compiled artifacts with `scripts/import-contracts.ts` and record their source commit in `artifacts/source.json`.

The application uses only configured RPC endpoints and injected wallets. Core, FreeLP and FreeLPDataFetcher addresses are fixed by the build; never expose protocol address overrides. Network dialogs accept an RPC URL and detect chain ID. No hosted metadata, token APIs, indexers, relays, analytics, fonts, or transaction services. All position/NFT data is on-chain. Distribute the static app as @ekubo/freelp, runnable with bunx or npx. Do not add attestations or compiled launchers.

Use plain black/white styling and system fonts. Retain required license and protocol identifiers.

Wrap user-facing copy in Lingui macros (`Trans`, `t`). Run `bun run messages:extract --locale en` after changing copy and commit `src/locales/en.po`. Keep interpolations inside macros. Do not edit other locale catalogs manually.

Run lint, typecheck, unit tests, production build, accessibility checks, and Lighthouse thresholds. Exercise changed transaction flows with the local-chain browser tests. Complexity is capped at 10; simplify functions rather than raising the limit or adding suppressions.

Terms are informational: no acceptance gate, consent storage, or terms version. Preserve wallet confirmation, simulation, chain/account checks, and transaction locking. No executable runtime updates. Preserve reproducible inputs and per-commit IPFS records.

Every successful branch/tag build pins on the dedicated DigitalOcean node and attaches its gateway URL to the commit status and Actions summary. Keep FREELP_PUBLIC_RELEASE=false until stable IPNS publication is authorized separately.

The deploy.yml publish-npm job uses npm trusted publishing and the npm environment. Keep FREELP_NPM_PUBLISH=false and package.json private until launch is authorized. Do not add npm write tokens.
