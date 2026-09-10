# FreeLP development

Keep this repository, build artifacts, previews, and IPFS content private until launch readiness. Only the separate EVM contracts PR may be public. Never advertise private content to public IPFS peers or transparency logs.

Edit in a dedicated worktree; keep the default checkout clean. New Solidity belongs in EkuboProtocol/evm-contracts. Import pinned compiled artifacts with `scripts/import-contracts.ts` and record their source commit in `artifacts/source.json`.

The application uses only configured RPC endpoints and injected wallets. No hosted metadata, token APIs, indexers, relays, analytics, fonts, or transaction services. All position/NFT data is on-chain. The CLI verifies provenance before serving application bytes.

Use plain black/white styling and system fonts. Remove inherited branding; retain required copyright, license, and protocol identifiers.

Wrap user-facing copy in Lingui macros (`Trans`, `t`). Run `bun run messages:extract --locale en` after changing copy and commit `src/locales/en.po`. Keep interpolations inside macros. Do not edit other locale catalogs manually.

Run lint, typecheck, unit tests, and the production build. Exercise changed transaction flows with the local-chain browser tests. Complexity is capped at 10; simplify functions rather than raising the limit or adding suppressions.

Never bypass the shared terms/transaction gate, disable provenance verification, substitute untrusted trust roots, or treat an in-page badge as independent verification. Preserve reproducible build inputs and per-commit IPFS deployment records.
