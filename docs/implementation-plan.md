# FreeLP implementation

The current design replaces the former compiled launcher and GitHub attestation scheme with a self-contained @ekubo/freelp npm package. The package manager and trusted publisher establish distribution trust. IPFS remains an optional static deployment target with per-commit CAR artifacts; the app's runtime data still comes only from configured RPC endpoints and an injected wallet.

The application retains only EVM LP management: token selection/import, pool selection, current liquidity graphs, position creation/add/remove/collect/transfer/burn, per-network RPC configurations, and browser contract deployment. The 11 default mainnets and optional viem networks are listed in the README. No indexer, server, hosted token list, Starknet, swap, or TWAMM feature is required.

All authoritative position state and NFT metadata live in the ownerless FreeLP contract. UI preferences and imported token metadata live locally. Required contracts and fetchers can be deployed from bundled pinned artifacts; new Solidity remains a separate EVM contracts PR without unrelated complexity changes.

GitHub CI verifies the application, pins IPFS builds, and publishes tagged versions to npm through trusted publishing. GitHub releases contain notes only.
