# Position creation and shared deployments

## Requirements and implementation

- Position creation retains the official interface's core interactions within the RPC-only scope: bundled/imported token selection, per-chain pools and fee tiers, current on-chain liquidity charts, editable ranges and graph controls, percentage/full-range choices, balance shortcuts, linked deposit amounts, live deposit previews, approvals, and creation. No historical volume, token prices in USD, or indexer-dependent recommendations are required.
- The home page has no deployment shortcut. Deploy remains a navigation tab. Network cards select the network's positions page.
- The 11 EVM mainnets supported by the current official interface are bundled with RPCs and shared contract addresses. Settings has an explicit Add network action with persistent name, chain ID, RPC, native symbol, and contract configuration.
- Core, FreeLP, and all three fetchers deploy through the standard CREATE2 factory at `0x4e59b44847b379578588920cA78FbF26c0B4956C`, using the protocol salt `0x28f4114b40904ad1cfbb42175a55ad64187c1b299773bd6318baa292375cf0dd`. There is no account-dependent salt or editable deployment salt.
- The canonical Core is `0x00000000000014aA86C5d3c41765bb24e11bd701`. With this Core and the pinned artifact, FreeLP is `0x775A601a3aF4Ccb4a79FF01FAFB455F0Af8fdaC0` for every deploying account and network. Changing constructor Core or bytecode necessarily changes the dependent CREATE2 address; custom-Core deployments show their actual prediction.
- Deployment cards show the predicted address, code presence and verification state, disable deployment while checking or when code exists, and allow adopting an already verified deployment. The transaction boundary rechecks chain, factory runtime, fixed payload, existing target code, and Core binding before simulation and wallet submission. Terms remain mandatory.

## Verification

The local-chain suite deploys Core and FreeLP from different accounts, checks their fixed addresses and runtime, rejects duplicate deployment, detects conflicting code and missing factory, and rejects wrong-chain RPC configuration. Browser lifecycles cover deployments from the UI, native/ERC20/nonstandard-token positions, automatic matching amounts, manual limits, approvals, collection, withdrawal, and burn. Settings tests cover all 11 mainnets, custom network persistence, and absence of home deployment shortcuts.

Live RPC checks on 2026-09-11 verified chain IDs and the exact Core, QuoteDataFetcher, CoreDataFetcher, and TokenDataFetcher runtimes on all 11 mainnets. No FreeLP code was present at the shared manager address at that time. It is preconfigured, but still needs a one-time on-chain deployment on each network through the Deploy tab. These checks did not spend real-network gas or represent mainnet contract deployment.

New pools require an explicit initial price; no 1:1 price is silently assumed. Matching amounts come from the pinned manager's integer quote at a single block. Range display math is approximate, while transaction amounts and slippage limits use integer contract results. An incomplete or stale preview cannot enable creation.

Network list source: EkuboProtocol/interface commit `4ba91a1c3e320b3ffa1cdd1622e2488cc634f95d`, `src/constants/evm/chains.ts`. This supersedes the earlier eight-network snapshot. The current upstream list excludes World Chain and MegaETH because Core requires an opcode those chains have not activated; Starknet remains outside this EVM-only app. Untouched testnet presets saved by older builds are retired; customized network settings are preserved.
