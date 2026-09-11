Deposit amounts now use pinned @ekubo/sdk math locally, including EVM rounding compatibility verified against FreeLP quotes. Editing amounts or ranges makes no quote RPC calls. The Advanced switch hides pool presets and exposes a single fee input with an exact-amount toggle. The liquidity chart shares the selected-range section, shows both token amounts per price bucket, and supports hover, drag selection, zoom, and the interface's centered range presets. Slider controls, full-range and manual preview buttons are removed.

Wallets supporting EIP-5792 can batch required approval resets, approvals and deposits without requiring atomic execution. Separate approvals remain available. Batch simulation, wallet/account checks, receipt verification and transaction locking are preserved. Withdrawals and fee claims use one manager multicall.

Network settings now use viem's chain catalog and public clients. Only the chosen 11 mainnets are enabled by default, with no RPC overrides. Enable or disable other mainnets in Settings, or enter an optional RPC override. Chain names and native-token metadata come from viem. Custom-network creation and metadata editors are removed. Disabled chains remain disabled after reload, including when every chain is off.

The recommended commands are `bunx @ekubo/freelp@latest` and `npx @ekubo/freelp@latest`. The app's copyable commands, CLI help and documentation include `@latest`.

FreeLP loads the selected pool automatically through its configured RPC. Advanced pool settings contain the fee, pool type, tick spacing and extension; liquidity charts and price ranges appear below pool selection. Initial-price fields appear only for uninitialized pools. Prices and numeric URL parameters snap to usable values with an adjustment indicator, while incoming links retain their original parameters.

Amount validation runs before RPC calls. Deposit previews reuse pool state and batch token balances and allowances through FreeLPDataFetcher. RPC failures show concise messages. Network settings include native-token metadata, save a unique zero-address native token, and deduplicate token addresses within each chain. Copy feedback clears after one second.

The npm distribution is configured for public publication after verification and runs with bunx or npx. Source remains private. Each verified CI build is pinned to IPFS and linked from its commit status and Actions summary.
