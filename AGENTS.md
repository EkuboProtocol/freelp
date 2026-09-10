# FreeLP development

Keep this repository, build artifacts, previews, and IPFS content private until launch readiness. Only the separate EVM contracts PR may be public. Never advertise private content to public IPFS peers or transparency logs.

Edit in a dedicated worktree; keep the default checkout clean. New Solidity belongs in EkuboProtocol/evm-contracts. Import pinned compiled artifacts with `scripts/import-contracts.ts` and record their source commit in `artifacts/source.json`.

The application uses only configured RPC endpoints and injected wallets. No hosted metadata, token APIs, indexers, relays, analytics, fonts, or transaction services. All position/NFT data is on-chain. Distribute the static app as @ekubo/freelp, runnable with bunx or npx. Trust comes from the installed package; do not add GitHub attestations or compiled launcher binaries.

Use plain black/white styling and system fonts. Remove inherited branding; retain required copyright, license, and protocol identifiers.

Wrap user-facing copy in Lingui macros (`Trans`, `t`). Run `bun run messages:extract --locale en` after changing copy and commit `src/locales/en.po`. Keep interpolations inside macros. Do not edit other locale catalogs manually.

Run lint, typecheck, unit tests, production build, accessibility checks, and Lighthouse thresholds. Exercise changed transaction flows with the local-chain browser tests. Complexity is capped at 10; simplify functions rather than raising the limit or adding suppressions.

Never bypass the shared terms/transaction gate. Preserve package integrity through the trusted package registry; do not fetch executable application updates at runtime. Preserve reproducible build inputs and per-commit IPFS deployment records.

Tagged public releases pin on the dedicated DigitalOcean node before the separate IPNS job advances its pointer. Keep FREELP_PUBLIC_RELEASE=false and do not pin private app CARs on that online node before launch.
