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

Ethereum, Arbitrum, Base, Robinhood Chain, Optimism, BNB Smart Chain, Gnosis, Unichain, Polygon, Monad, and Ink are enabled by default. Enable other mainnets or override their RPC URLs in Networks. Import tokens by address using their on-chain metadata.

If required contracts are missing on a network, the Deploy page can deploy Core, FreeLP, and FreeLPDataFetcher at their fixed addresses.

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
