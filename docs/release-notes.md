FreeLP 0.1.11 removes browser-side transaction tracking and history-based locks.

Transaction history belongs to your wallet. FreeLP no longer stores a transaction journal, displays browser activity, or tries to recover past requests after a reload. Old records and missing transaction hashes cannot prevent new actions.

Controls use current on-chain balances, allowances, ownership, liquidity, and fees. The current action still performs simulation, verifies the wallet account and network, and temporarily prevents duplicate clicks while submitting. Confirmation errors direct you to your wallet.

Contract artifacts and deployment addresses are unchanged from 0.1.10.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
