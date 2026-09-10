# FreeLP

EVM liquidity position management using only RPC endpoints and an injected wallet. No swaps, TWAMM orders, indexer, hosted metadata, API keys, analytics, or application fee. Position records and NFT metadata are on-chain. Network gas still applies.

**Private development:** do not publish this repository, npm package, or IPFS content before launch readiness. Solidity changes live separately in EkuboProtocol/evm-contracts.

## Run the packaged app

Once published, `bunx @ekubo/freelp` or `npx @ekubo/freelp` serves the complete installed application on localhost and opens your browser. Use `--no-browser` or `--port 4173` as needed. A specific version can be selected with `bunx @ekubo/freelp@VERSION`.

Trust the package publisher and your package manager's integrity checks. The package contains its static assets and has no runtime package dependencies. The launcher does not contact GitHub, download a second build, or handle wallet keys. Use Node 22+ for npx, or Bun for bunx. No runtime binary is distributed.

During private development, build with `bun install --frozen-lockfile && bun run pack:app`. Test the resulting tarball with `bun scripts/check-package.ts ekubo-freelp-0.1.1.tgz`, or run `node cli-dist/main.js` from the built checkout. Packing does not publish; `private: true` prevents accidental npm publication.

## Use FreeLP

Robinhood Chain, Base, Arbitrum, and Ethereum have bundled network configurations and free public RPC defaults. Each network retains its own RPC and contract addresses. Settings also supports custom EVM networks. Public RPC operators can change availability; replace an endpoint or use your own node at any time.

Choose bundled tokens or import a token by address using on-chain metadata. Select a fee tier and discover existing pools using QuoteDataFetcher. The liquidity chart reconstructs current liquidity from initialized ticks, using the original interface's liquidity math. It shows only the fetched tick range, without historical or USD data. Choose a range, preview amounts, approve tokens, and create a position. Positions can be listed across configured networks and managed on their respective network.

Canonical Core and QuoteDataFetcher addresses are bundled. A FreeLP manager must be configured or deployed before managing positions. The Deploy page can deploy Core, FreeLP, QuoteDataFetcher, CoreDataFetcher, and TokenDataFetcher from pinned artifacts, verifies the resulting runtime, and saves addresses per network. Deploying a fresh Core creates an independent liquidity system. Wallet transactions require terms acceptance and wallet confirmation.

## Development and verification

Use Bun 1.4.0. Run `bun run dev`, `bun run lint`, `bun run check-ts`, `bun run test`, and `bun run build`. Browser tests use Anvil with Osaka support at port 18545: `anvil --port 18545 --hardfork osaka --silent`, then `bun run test:e2e`. Only documented local development keys are used.

## IPFS

CI builds and packages each main commit and version tag. `bun scripts/package-release.ts SOURCE_COMMIT` produces the static site's CAR, manifest, and `deployment.json` with its CID and source commit. CI tests both an isolated IPFS gateway and the npm tarball, then retains artifacts in a private GitHub release. No npm publication occurs.

While private, content is imported only into an isolated offline Kubo node. After public launch, tagged builds seed the site’s CAR on IPFS. A separate IPNS job confirms a durable pin on the allocated DigitalOcean node before updating the stable name, and renews that record every 12 hours. Retain `site.car` on user-operated nodes for continuing availability; a CID verifies content but does not guarantee permanent storage. Restore a public deployment with `ipfs dag import site.car`. Before launch, use only an isolated offline repository and never advertise its content to peers.

## Licensing

New interface and CLI code are MIT. The repository started with one squashed reduced-interface commit; squashing does not relicense dependencies or contract artifacts. Reused Ekubo interface math, ABI, and configuration logic are identified in source. Retain the licenses and attribution in THIRD_PARTY_NOTICES.md.

See [distribution and infrastructure](docs/distribution.md) for the bunx/npx commands, immutable IPFS and stable IPNS URLs, allocated node, privacy gates, and recovery instructions.
