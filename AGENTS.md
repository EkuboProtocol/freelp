# FreeLP development

FreeLP is prepared for open-source distribution under MIT. CI publishes verified npm releases from tags and IPFS previews from successful builds. Publish only the current build’s site CAR.

Use worktrees; keep main clean. New Solidity belongs in EkuboProtocol/evm-contracts. Import pinned compiled artifacts with `scripts/import-contracts.ts` and record their source commit in `artifacts/source.json`.

The application uses only configured RPC endpoints and injected wallets. Core, FreeLP and FreeLPDataFetcher addresses are fixed by the build; never expose protocol address overrides. Use viem chains and defaults. Enable only the four mainnets with deployed contracts (4663, 8453, 42161, 1) initially; persist explicit RPC overrides. No hosted metadata, token APIs, indexers, relays, analytics, fonts, or transaction services. All position/NFT data is on-chain. Distribute the static app as @ekubo/freelp, runnable with bunx or npx. Do not add attestations or compiled launchers.

Use black/white styling and system fonts. Retain required license and protocol identifiers.

PoolKeyIndex and FreeLPMetadataRenderer are also fixed by the build. Discover registered pools with bounded, block-pinned pairPoolIdCount/pairPoolIds reads; registry coverage is not all initialized Core pools. Creation prepends maybeInitializePool; deposits require positive minimum liquidity and include refundNativeToken in the same manager multicall. Withdrawals have no minimum-output arguments. Import compiler AST-derived immutable bindings, verifying Core, index, and renderer addresses.

Use plain English JSX and strings for user-facing copy. No translation framework or catalogs.

Run lint, typecheck, unit tests, production build, accessibility checks, and Lighthouse thresholds. Exercise changed transaction flows with the local-chain browser tests. Complexity is capped at 10; simplify functions rather than raising the limit or adding suppressions.

Terms are informational: no acceptance gate, consent storage, or terms version. Preserve wallet confirmation, chain/account checks, and an in-memory lock for the active submission. Do not simulate transactions in the app (including gas-estimation execution); wallets handle execution checks and gas. Transaction history belongs to the wallet: do not persist, recover, or display a browser transaction journal, or block actions based on historical requests. Availability comes from current blockchain state. No executable runtime updates. Preserve reproducible inputs and per-commit IPFS records.

Every successful branch/tag build pins on the DigitalOcean node and attaches its gateway URL to the commit status and Actions summary. Keep FREELP_PUBLIC_RELEASE=false until stable IPNS publication is authorized separately.

The deploy.yml publish-npm job uses npm trusted publishing and the npm environment. Trusted publishing is configured; FREELP_NPM_PUBLISH=true. Do not add npm write tokens.
