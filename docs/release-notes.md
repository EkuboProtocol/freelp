FreeLP 0.1.12 simplifies submission, adds batch deployment, and fixes position navigation.

The app no longer simulates transactions or sends gas estimates before requesting your wallet. Native Max uses a labeled provisional reserve from current fee data. Wallets handle execution checks and gas, while the app verifies chain/account identity and contract code.

Batch-capable wallets can use Deploy all to deploy missing contracts in dependency order with one wallet request. Existing verified deployments are skipped.

Back, Positions, and All positions now reliably return from a single position to the list. This release also includes the refined position-creation layout and removes Create from the main navigation; creation remains available from Positions.

Contract artifacts are pinned to evm-contracts commit 352c8b3, including deposit-continuity and combined-withdrawal overflow fixes with caller-managed native refunds. FreeLP and FreeLPDataFetcher have new deployment addresses. Earlier NFTs remain at their original manager and need a compatible release.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
