FreeLP 0.1.10 updates the application for the latest FreeLP contracts and on-chain NFT artwork.

Registered pools are discovered directly by token pair using bounded, block-pinned RPC reads. The Deploy page includes the immutable metadata renderer, and runtime verification checks the manager's Core, registry, and renderer bindings.

Position creation atomically initializes the pool when needed, deposits liquidity, and refunds excess native currency. Deposits require positive minimum liquidity. Withdrawals and fee collection use the updated contract interface; withdrawal receipts are estimates, with no minimum-output guarantee or withdrawal slippage control.

The new PoolKeyIndex, FreeLPMetadataRenderer, FreeLP, and FreeLPDataFetcher addresses can be deployed from the Deploy page. Earlier NFTs remain in their original manager and require a release targeting that manager. The new registry has its own registrations; previous registry entries are not automatically migrated.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
