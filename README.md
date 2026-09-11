# FreeLP

EVM liquidity position management using only RPC endpoints and an injected wallet. No swaps, TWAMM orders, indexer, hosted metadata, API keys, analytics, or application fee. Position records and NFT metadata are on-chain. Network gas still applies.

**Private source:** keep this repository and npm package private until launch readiness. Successful CI builds have user-authorized public IPFS previews. Solidity changes live separately in EkuboProtocol/evm-contracts.

## Run the packaged app

Once published, `bunx @ekubo/freelp` or `npx @ekubo/freelp` serves the complete installed application on localhost and opens your browser. Use `--no-browser` or `--port 4173` as needed. A specific version can be selected with `bunx @ekubo/freelp@VERSION`.

Trust the package publisher and your package manager's integrity checks. The package contains its static assets and has no runtime package dependencies. The launcher does not contact GitHub, download a second build, or handle wallet keys. The launcher requires Node 22+; the bunx command additionally requires Bun. No runtime binary is distributed.

During private development, build with `bun install --frozen-lockfile && bun run pack:app`. Test the resulting tarball with `bun scripts/check-package.ts ekubo-freelp-0.1.1.tgz`, or run `node cli-dist/main.js` from the built checkout. Packing does not publish; `private: true` prevents accidental npm publication.

## Use FreeLP

Ethereum, Arbitrum, Base, Robinhood Chain, Optimism, BNB Smart Chain, Gnosis, Unichain, Polygon, Monad, and Ink have bundled mainnet configurations and free public RPC defaults. Each network retains its own RPC and contract addresses. Testnets are not bundled. Use Add network in Settings for custom EVM networks. Public RPC operators can change availability; replace an endpoint or use your own node at any time.

Choose bundled tokens or import a token by address using on-chain metadata. The searchable picker groups held tokens first, shows network labels and wallet balances, and supports arrow-key navigation. Balances load in one FreeLPDataFetcher call per chain and share a short-lived cache with the deposit controls; refresh or transaction completion updates them. Failed balance queries remain explicit. Prices use decimal notation. Tick spacing is shown as a percentage, with presets, custom percentages rounded to the nearest valid spacing, and exact integer ticks available. Pool discovery preserves your chosen spacing and entered range. Select a fee and discover pools using FreeLPDataFetcher. Any valid concentrated spacing or stableswap amplification/center can be used with any extension address; an exact uint64 fee input preserves arbitrary fee bits. Create form values are shareable through the URL and survive reloads. Matching deposit amounts are always calculated automatically from the edited side. The liquidity chart reconstructs current liquidity from initialized ticks, using the original interface's liquidity math. It shows only the fetched tick range, without historical or USD data. Choose a range, preview amounts, approve tokens, and create a position. Positions can be listed across configured networks and managed on their respective network.

The canonical Core address is bundled. The shared FreeLP manager address is bundled; it needs a one-time deployment on each network before managing positions. The Deploy page uses a fixed CREATE2 salt for Core, FreeLP, and FreeLPDataFetcher, detects existing code, verifies the runtime, and saves addresses per network. Every user gets the same address for the same Core and pinned bytecode. Deploying a fresh Core creates an independent liquidity system. Wallet transactions require terms acceptance and wallet confirmation.

## Development and verification

Use Bun 1.4.0. Run `bun run dev`, `bun run lint`, `bun run check-ts`, `bun run test`, and `bun run build`. Browser tests use Anvil with Osaka support at port 18545: `anvil --port 18545 --hardfork osaka --silent`, then `bun run test:e2e`. Only documented local development keys are used.

## IPFS

CI builds and packages each main commit and version tag. `bun scripts/package-release.ts SOURCE_COMMIT` produces the static site's CAR, manifest, and `deployment.json` with its CID and source commit. CI tests both an isolated IPFS gateway and the npm tarball, then retains artifacts in a private GitHub release. No npm publication occurs.

Each successful branch or version-tag build is pinned on the persistent DigitalOcean IPFS node. Find its gateway URL in the commit’s **IPFS preview** status or the Actions job summary. The source repository and npm releases remain private. Never bring a historical private IPFS blockstore online; CI publishes only the current build’s CAR.

Stable IPNS updates remain a separate, launch-gated job. A CID identifies immutable content; IPNS identifies the selected stable release. Restore an authorized public deployment with `ipfs dag import site.car`.

## Licensing

New interface and CLI code are MIT. The repository started with one squashed reduced-interface commit; squashing does not relicense dependencies or contract artifacts. Reused Ekubo interface math, ABI, and configuration logic are identified in source. Retain the licenses and attribution in THIRD_PARTY_NOTICES.md.

See [distribution and infrastructure](docs/distribution.md) for the bunx/npx commands, immutable IPFS and stable IPNS URLs, allocated node, privacy gates, and recovery instructions.

See [position UX and deterministic deployment validation](docs/ship-ux.md) for the shared addresses, deployment status, and tested behavior.

The positions page combines all configured networks. A stateless FreeLPDataFetcher returns each owner’s complete position snapshot in one `eth_call` per chain; deploy it once from the Deploy tab. The manager’s fixed address is unchanged. Token selection identifies the chain for creation, while management actions use the selected position’s chain and request wallet switching as needed. Settings and Deploy retain network controls for their specific tasks.

FreeLPDataFetcher inherits the pool quote and sparse token balance readers, so positions, liquidity charts, balances and allowances share one configured reader address. No standalone Quote/Core/Token data fetcher deployment is required. The existing Core still hosts pools; a fresh network may deploy Core from the same page.
