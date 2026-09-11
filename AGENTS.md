# FreeLP development

Source stays private. npm publication is authorized after pool-flow fixes pass verification. Successful CI builds may publish IPFS previews. Publish only that build’s site CAR; never expose historical private IPFS blockstores. EVM contracts PRs may be public.

Use worktrees; keep main clean. New Solidity belongs in EkuboProtocol/evm-contracts. Import pinned compiled artifacts with `scripts/import-contracts.ts` and record their source commit in `artifacts/source.json`.

The application uses only configured RPC endpoints and injected wallets. Core, FreeLP and FreeLPDataFetcher addresses are fixed by the build; never expose protocol address overrides. Network dialogs accept an RPC URL and detect chain ID. No hosted metadata, token APIs, indexers, relays, analytics, fonts, or transaction services. All position/NFT data is on-chain. Distribute the static app as @ekubo/freelp, runnable with bunx or npx. Do not add attestations or compiled launchers.

Use black/white styling and system fonts. Retain required license and protocol identifiers.

Wrap user-facing copy in Lingui macros (`Trans`, `t`). Run `bun run messages:extract --locale en` after changing copy and commit `src/locales/en.po`. Keep interpolations inside macros. Do not edit other locale catalogs manually.

Run lint, typecheck, unit tests, production build, accessibility checks, and Lighthouse thresholds. Exercise changed transaction flows with the local-chain browser tests. Complexity is capped at 10; simplify functions rather than raising the limit or adding suppressions.

Terms are informational: no acceptance gate, consent storage, or terms version. Preserve wallet confirmation, simulation, chain/account checks, and transaction locking. No executable runtime updates. Preserve reproducible inputs and per-commit IPFS records.

Every successful branch/tag build pins on the dedicated DigitalOcean node and attaches its gateway URL to the commit status and Actions summary. Keep FREELP_PUBLIC_RELEASE=false until stable IPNS publication is authorized separately.

The deploy.yml publish-npm job uses npm trusted publishing and the npm environment. Keep FREELP_NPM_PUBLISH=false until trusted publishing is configured. Do not add npm write tokens.
