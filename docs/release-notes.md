FreeLP 0.1.13 gates network enabling on verified contract code and scopes deployment to one chain.

Enabling a network in Networks now reads its chain ID and the code of the five required contracts once, compares that code with this build, and enables only when everything matches. Missing, incompatible, or unreachable networks stay disabled and open a modal that explains which case occurred, with Deploy on this network, Retry, and Cancel. Listing networks makes no RPC requests: rows show Ready, Needs deployment, or Not checked from local configuration and remembered successful checks. Disabling never contacts the RPC, and failed checks are never remembered.

Deploy moved out of the main navigation. Each network row offers Deploy contracts, which opens `#/deploy/<chainId>` for that chain only; the creation gate and the enable modal link there too. A bare `#/deploy` opens the active network, and links naming an unsupported chain point back to Networks. Deployment never enables a network. After the contracts exist, enable the network in Networks, which verifies the deployed code again.

Pool initialization continues to come from live Core state through the data fetcher, never from PoolKeyIndex registration, and creation still prepends maybeInitializePool. Contract artifacts remain pinned to evm-contracts commit 352c8b3. The contract repository gains a Foundry bootstrap script that deploys or reuses the same five contracts and seeds PoolKeyIndex with pool keys fetched live from the Ekubo API; no pool data is committed.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.

FreeLP 0.1.12 simplifies submission, adds batch deployment, and fixes position navigation.

The app no longer simulates transactions or sends gas estimates before requesting your wallet. Native Max uses a labeled provisional reserve from current fee data. Wallets handle execution checks and gas, while the app verifies chain/account identity and contract code.

Batch-capable wallets can use Deploy all to deploy missing contracts in dependency order with one wallet request. Existing verified deployments are skipped.

Back, Positions, and All positions now reliably return from a single position to the list. This release also includes the refined position-creation layout and removes Create from the main navigation; creation remains available from Positions.

Contract artifacts are pinned to evm-contracts commit 352c8b3, including deposit-continuity and combined-withdrawal overflow fixes with caller-managed native refunds. FreeLP and FreeLPDataFetcher have new deployment addresses. Earlier NFTs remain at their original manager and need a compatible release.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
