# Position creation and shared deployments

## Requirements and implementation

- Position creation retains the official interface's core interactions within the RPC-only scope: bundled/imported token selection, per-chain pools and fee tiers, current on-chain liquidity charts, editable ranges and graph controls, percentage/full-range choices, balance shortcuts, linked deposit amounts, live deposit previews, approvals, and creation. No historical volume, token prices in USD, or indexer-dependent recommendations are required.
- The home page has no deployment shortcut. Deploy remains a navigation tab. Positions are combined across networks without a global network selector.
- The 11 EVM mainnets supported by the current official interface are bundled with RPCs and shared contract addresses. Settings has an explicit Add network action with persistent name, chain ID, RPC, native symbol, and contract configuration.
- Core, FreeLP, and the fetchers deploy through the standard CREATE2 factory at `0x4e59b44847b379578588920cA78FbF26c0B4956C`, using the protocol salt `0x28f4114b40904ad1cfbb42175a55ad64187c1b299773bd6318baa292375cf0dd`. There is no account-dependent salt or editable deployment salt.
- The canonical Core is `0x00000000000014aA86C5d3c41765bb24e11bd701`. With this Core and the pinned artifact, FreeLP is `0x573af249A268ed80c358dA77986D2e637978A611` for every deploying account and network. Core and dependent addresses are fixed in this build; custom-Core overrides are no longer supported.
- Deployment cards show the predicted address, code presence and verification state, disable deployment while checking or when code exists, and allow adopting an already verified deployment. The transaction boundary rechecks chain, factory runtime, fixed payload, existing target code, and Core binding before simulation and wallet submission. Terms remain mandatory.

## Verification

The local-chain suite deploys Core and FreeLP from different accounts, checks their fixed addresses and runtime, rejects duplicate deployment, detects conflicting code and missing factory, and rejects wrong-chain RPC configuration. Browser lifecycles cover deployments from the UI, native/ERC20/nonstandard-token positions, automatic matching amounts, approvals, collection, withdrawal, and burn. Settings tests cover all 11 mainnets, custom network persistence, and absence of home deployment shortcuts.

Live RPC checks on 2026-09-11 verified chain IDs and the exact Core, QuoteDataFetcher, CoreDataFetcher, and TokenDataFetcher runtimes on all 11 mainnets. No FreeLP code was present at the shared manager address at that time. It is preconfigured, but still needs a one-time on-chain deployment on each network through the Deploy tab. These checks did not spend real-network gas or represent mainnet contract deployment.

New pools require an explicit initial price; no 1:1 price is silently assumed. Matching amounts come from the pinned manager's integer quote at a single block. Range display math is approximate, while transaction amounts and slippage limits use integer contract results. An incomplete or stale preview cannot enable creation.

Network list source: EkuboProtocol/interface commit `4ba91a1c3e320b3ffa1cdd1622e2488cc634f95d`, `src/constants/evm/chains.ts`. This supersedes the earlier eight-network snapshot. The current upstream list excludes World Chain and MegaETH because Core requires an opcode those chains have not activated; Starknet remains outside this EVM-only app. Untouched testnet presets saved by older builds are retired; customized network settings are preserved.

## Aggregate portfolio reads

FreeLPDataFetcher at `0xaf388FFa60a69D0bc59E0D31a9313D28EB8E3b18` is a new stateless reader, deployed through the same fixed-salt factory. It returns every position’s descriptor, amounts/fees, current pool price, and on-chain metadata in a single `eth_call`, including the chain ID for RPC configuration validation. The client sorts the returned IDs without pagination or block-number/code/enumeration follow-up requests. Each configured chain loads independently once per portfolio refresh; failed chains remain visible in the availability details.

Selecting a position uses its network configuration without changing global state or repeating the portfolio query. Wallet balances and allowances are read when opening management; transaction simulation, verification, wallet chain switching, and receipt polling remain separate from the portfolio read. Creating a position selects the chain through a token labelled with its network. Settings and Deploy retain their network controls for configuration and deployment targeting.

This new reader is not yet deployed on public networks; Deploy can create it once per chain. A read test with 257 positions asserts exactly one RPC request. The local-chain lifecycle verifies deploying the reader and using its results through creation, transfers, fee collection, withdrawals, and burns. Very large portfolios may exceed a provider’s gas or response limits; the app reports the failure without silently omitting positions.

## Token selection and price controls

The token picker ports the official interface's sparse TokenDataFetcher balance read, held-token grouping, and keyboard navigation. Opening the all-network picker makes one balance call per configured chain. Deposit cards share those cached reads; selecting a network does not invalidate them. Cache entries expire after 30 seconds and transaction completion, configuration changes, or manual refresh trigger new reads. Missing balances are distinguished from zero balances. Native and ERC20 deposit shortcuts retain integer precision.

Prices, range inputs generated by presets, and chart labels use decimal notation. Tick spacing uses the original interface's `(1.000001^spacing - 1) * 100` percentage conversion. Users can select presets, enter a percentage rounded to a valid integer spacing, or enter exact ticks. Discovery preserves custom fee/spacing selections and entered range bounds even when other initialized pools exist. The real-chain browser test covers that regression; the picker test checks one call per chain, cache reuse after selection, keyboard behavior, mobile overflow, and accessibility with balances loaded.


## Shareable pool forms

Create form values live in the URL fragment, including chain ID, tokens, extension, fee (percentage or exact uint64), concentrated spacing or stableswap amplification/center, range mode/bounds, initial price, amounts, edited side, slippage, and fallback decimals. Reload and browser history restore them. RPC credentials, wallet identity, approvals, and consent are not form values and never enter these links. A chain must already be configured locally before using its link.

Matching amounts are mandatory and follow the last edited amount. Fee and spacing presets appear only inside edit disclosures. Stableswap bounds follow Core's amplification/center rules; extension addresses pass through without an allowlist or extension-specific requests. The manager validates through the shared PoolKey/PositionId rules and uses the global fee accumulator for stableswap. New manager/fetcher bytecode changes the shared deployment addresses above; existing configured deployments remain explicit and can be replaced from Deploy. No real-chain deployment was performed for this update.

## Unified reader and compact picker

FreeLPDataFetcher now inherits QuoteDataFetcher and TokenDataFetcher. Its predicted address for canonical Core is `0xE6965adE98F992e197554eDbF05c6E781e5127db`; it requires a new deployment per network. The manager address is unchanged. The app configures one reader address and no longer bundles or deploys the three standalone readers. Core remains a separate existing pool dependency and can still be deployed on a fresh network. Token group headings are removed, with refresh inline beside search and held balances first.

Validation: 27 unit tests, 14 browser tests, no Axe violations at mobile/desktop sizes; Lighthouse performance 97 mobile/100 desktop and accessibility 100. The new Solidity quote/balance integration test and all 23 FreeLP tests pass; the full snapshot run has 979 passing tests and the same four pre-existing ExposedStorage failures previously reproduced on the parent.

## Fixed contracts, network dialogs and account header

Saved protocol address overrides are normalized to the bundled deployments. Deployment has no activation button. Settings now list all networks, with RPC-only Add/Edit dialogs that detect and validate chain identity. Import/export and manual verification controls are removed; transaction verification remains automatic. A local monochrome identicon and address menu sit in the header. Create is accessed from Positions. IPFS/IPNS information is removed from the application, with distribution links retained in CI/docs. Wallet errors extract readable messages instead of stringifying objects.
