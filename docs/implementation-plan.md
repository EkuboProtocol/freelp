# FreeLP implementation

The current design replaces the former compiled launcher and GitHub attestation scheme with a self-contained @ekubo/freelp npm package. The package manager and trusted publisher establish distribution trust. IPFS remains a static deployment target with per-commit CAR artifacts.

The application retains only EVM LP management: token selection/import, pool discovery, current liquidity graphs, position creation/add/remove/collect/transfer/burn, per-network RPC configurations, and browser contract deployment. Robinhood Chain, Base, Arbitrum, and Ethereum are the initial networks. No indexer, server, hosted token list, Starknet, swap, or TWAMM feature is required.

All authoritative position state and NFT metadata live in the ownerless FreeLP contract. UI-only preferences, imported token hints, and consent receipts live locally. Required contracts and fetchers can be deployed from bundled pinned artifacts; new Solidity remains a separate EVM contracts PR without unrelated complexity changes.

Keep code and deployment content private until launch. Package creation and offline IPFS verification are allowed during development; public publication is not part of the current CI workflow.
