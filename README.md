# FreeLP

Manage EVM liquidity positions using only RPC endpoints and your wallet. No application fees, indexers, hosted token APIs, or API keys. Position data and NFT metadata live on-chain.

## Run

```sh
bunx @ekubo/freelp@latest
# or
npx @ekubo/freelp@latest
```

The package serves the app locally and opens your browser. Requires Node.js 22+; the Bun command also requires Bun. Use `--no-browser` to skip opening the browser or `--port 4173` to choose a port.

You can also open an IPFS build from the **IPFS preview** commit status or GitHub Actions summary.

## Use

Connect your wallet to view positions across enabled networks. Create a position by selecting a network, tokens, pool, and price range. Deposit amounts are calculated locally; the liquidity chart supports hover, zoom, and range selection. Add liquidity, withdraw, or claim fees from your positions.

The portfolio shows NFTs owned in the FreeLP manager. Official Ekubo Positions v2/v3 and Ve33 NFTs use different managers and are not included. Withdrawing all liquidity burns the FreeLP NFT; fee collection preserves it.

Use minimum/maximum price fields or exact ticks to edit ranges with a keyboard. New pools require an explicit initial price. Native-token **Max available** leaves a provisional reserve of 1,000,000 gas per draft call at current network fees, without executing the draft. Your wallet sets the final transaction gas; the app does not simulate submissions. Batch-capable wallets can deploy all missing contracts with **Deploy all**. Network gas and token/pool/extension costs are separate from FreeLP's zero application fees.

This browser's activity retains submitted hashes and wallet batch IDs. If confirmation is unavailable, use **Check status** instead of repeating the action. Reconnect the submitting account and enable its network to recover after reload. A wallet that fails to return any identifier requires checking its own activity; FreeLP cannot infer whether that request was broadcast.

Once loaded, the bundled app uses only configured RPC endpoints and injected wallets for application data and signing. Installing through npm or loading through an IPFS gateway involves distribution traffic; wallet-internal networking is controlled by your wallet.

Ethereum, Arbitrum, Base, Robinhood Chain, Optimism, BNB Smart Chain, Gnosis, Unichain, Polygon, Monad, and Ink are enabled by default. Enable other mainnets or override their RPC URLs in Networks. Listing networks makes no RPC requests; rows show **Ready**, **Needs deployment**, or **Not checked** from local configuration and remembered successful checks. Enabling a network reads its chain ID and the code of the five required contracts once, then compares that code with this build. Networks that are missing contracts, hold incompatible code, or do not answer stay disabled and explain why, with a link to deploy on that network. Disabling never contacts the RPC, and failed checks are never remembered. Import tokens by address using their on-chain metadata.

If required contracts are missing on a network, **Deploy contracts** from that network's row in Networks opens `#/deploy/<chainId>`, which can deploy Core, the shared PoolKeyIndex, the metadata renderer, FreeLP, and FreeLPDataFetcher at their fixed addresses on that network only. Deployment never enables a network; enable it afterwards in Networks, which verifies the deployed code again. Pair discovery reads registered keys from PoolKeyIndex; unregistered initialized pools can still be configured manually. Registration never implies initialization: pools can be initialized outside this interface, so the app reads each pool's live Core state to decide whether creation must set an initial price. Registry coverage is not a complete index of Core history.

This contract revision uses a new manager address. Existing NFTs remain in their original manager and require a compatible pinned release to manage them; upgrading the UI does not move positions. See [contract integration](docs/contracts.md) for the source pin and deployment addresses.

## Develop

Use Bun 1.4.0.

```sh
bun install --frozen-lockfile
bun run dev
```

Run `bun run lint`, `bun run check-ts`, `bun run test`, and `bun run build` to verify changes. Browser tests require Anvil with Osaka support on port 18545, then `bun run test:e2e`.

## Release

Set an unpublished version in `package.json`, commit the changes, and push a tag (conventionally `v<version>`). GitHub CI builds, tests, and publishes the verified package to npm through trusted publishing. Every successful build is pinned to IPFS; GitHub releases contain notes only.

See [publishing setup](docs/npm-publishing.md) and [distribution](docs/distribution.md) for operational details.

## License

[MIT](LICENSE). Use at your own risk, without warranty. Third-party code and contract artifacts retain their respective licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).
