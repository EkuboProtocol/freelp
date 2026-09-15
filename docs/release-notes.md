FreeLP 0.1.18 calms the position page and cuts background RPC traffic.

The position page shows the NFT artwork beside the heading instead of behind a disclosure, and the liquidity and fee amounts drop their Exact amount disclosures; the exact figure is the hover title on each amount. Refreshes no longer happen on window focus, when opening a position from the list, or when opening the add or withdraw dialog, and a transaction reloads only its own network instead of every enabled one. The toolbar shows Updated with a time, or Updating…, in place, without a notice popping in and out. Refresh position remains for a manual reload.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.

FreeLP 0.1.17 enables only the four networks that carry this build's contracts by default.

Robinhood Chain, Base, Arbitrum, and Ethereum are the default networks; the pool index on each was seeded with every pool holding liquidity. Optimism, BNB Smart Chain, Gnosis, Unichain, Polygon, Monad, and Ink are no longer enabled by default. Browsers with saved preferences drop those seven once unless a network was verified through Enable or has a custom RPC URL; any network can be enabled again in Networks after its code check. Registered pool cards now show tick spacing as a percentage instead of raw ticks. The bundled token list now mirrors the Ekubo API: every token with a non-negative visibility priority on each bundled chain except the wrapped native token, about 8,500 entries including USDG on Ethereum, Unichain, Ink, and Robinhood Chain. The list ships as one JSON file per chain inside the app and is read from the app's own origin when a chain is first used, so the script bundle stays the same size; `bun scripts/sync-default-tokens.ts` refreshes it.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.

FreeLP 0.1.16 shows its version, links the source, and simplifies the network check.

The footer now carries a GitHub mark linking to the repository and the running version, injected from the package manifest at build time. About FreeLP is rewritten around what a user needs: what the app is, one run command, the version with the pinned contracts commit, a data and privacy note, and the license links. Contract addresses left the page; each network's Deploy page shows them beside the code check. The note about NFTs from earlier deployments moved to the empty Positions state.

The enable-network modal no longer lists individual contracts or offers Retry. It names the case, explains it, and offers Deploy on this network plus Cancel; an unreachable RPC only points at RPC settings. Network rows no longer carry a Deploy contracts link, so deployment is reached from the modal or the creation gate.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.

FreeLP 0.1.15 keeps withdrawals reachable when an RPC is busy and opens positions to anyone by ID.

Withdraw, collect, and add-liquidity requests now go to the wallet without any RPC read first: the ownerOf pre-check and the chain and code reads before signing are gone for position and token calls, and stale position data no longer disables actions. The wallet still confirms the account and network, and the contracts enforce ownership and amounts. Deployments keep their RPC-side verification.

A position link such as #/positions/1/42 now loads that position by ID, with or without a connected wallet, and shows its owner. Anyone can view it; only the owning wallet can sign, and other wallets see the actions disabled instead of "Position unavailable".

The withdraw dialog lists principal, fees, and estimated receipt with one line per token, drops the raw liquidity number, moves the recipient field next to the review, and hides the empty status line.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.

FreeLP 0.1.14 stops listing the same browser wallet twice.

Wallets that announce themselves through EIP-6963 often expose a different wrapper object on window.ethereum, so the injected-wallet fallback appeared next to the announced entry, for example Ambire alongside Injected wallet. The fallback now appears only when no wallet announced. Wallets that only inject window.ethereum are still offered.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.

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
