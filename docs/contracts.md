# Contract integration

Source: `EkuboProtocol/evm-contracts` at `352c8b3ecba328bb91a70da59121cee952b217a1` on `feat/freelp`. Solidity 0.8.33, Osaka, via-IR, optimizer 9,999,999 runs. The compiler output is imported with source-hash checks and AST-derived immutable roles. Runtime verification binds Core, PoolKeyIndex, and FreeLPMetadataRenderer separately; immutable bytes are never ignored.

| Contract               | Fixed address                                |
| ---------------------- | -------------------------------------------- |
| Core                   | `0x00000000000014aA86C5d3c41765bb24e11bd701` |
| PoolKeyIndex           | `0x827A68AC37AA3715c865F2E0704a63118496986f` |
| FreeLPMetadataRenderer | `0x3E3142aA2143bC05BA92986a9D4867C1409FB8E2` |
| FreeLP                 | `0x0dB596aF023b61c681c91c39E540829bf81bEcD5` |
| FreeLPDataFetcher      | `0x304bDc1869F392740aE879164428ae6A51B71114` |

CREATE2 predictions match the pinned contract repository's DeployFreeLP script. Deploy/reuse Core, PoolKeyIndex, and FreeLPMetadataRenderer before deploying FreeLP. The manager constructor takes those three addresses; the fetcher takes Core. The stateless renderer takes no constructor arguments. Batch-capable wallets can use Deploy all: the app checks current runtime code and submits only missing contracts in dependency order. It rejects incompatible occupied addresses and stale or altered batches, without transaction simulation.

Writes use flat arguments: `maybeInitializePool(key, initialTick)`, `createPosition(key, lower, upper, maxAmount0, maxAmount1, minLiquidity)`, `addLiquidity(id, maxAmount0, maxAmount1, minLiquidity)`, and `withdraw(id, liquidity, recipient)`. Withdrawal totals are uint256; the contract retains deposit owner/liquidity continuity and overflow-safe combined payouts. Creation and additions require positive minimum liquidity. Withdrawals have no minimum-output arguments; the UI displays estimated receipts and makes this explicit, with slippage controls limited to deposits. The UI retains fresh previews, exact token caps, and wallet identity checks. Execution checks, gas estimation, and transaction history belong to the wallet: the application does not simulate submissions or persist past requests.

Every deposit is a payable manager multicall containing the deposit followed by `refundNativeToken()`. Creation prepends an explicit `maybeInitializePool` call, which leaves existing pools unchanged. Native value is attached once to the outer transaction. Refunds must not be separate wallet-batch transactions: a later failure could otherwise leave funds in the manager. The wrapper works with standalone wallet submission and EIP-5792 approval batches alike.

The manager exposes `position(id)` and standard NFT ownership/enumeration. Descriptor, current pool state, and calculated principal/fees are read through FreeLPDataFetcher. Its `ownedPositions` response still contains complete snapshots and embedded metadata. The UI renders validated embedded NFT artwork without fetching image services.

PoolKeyIndex offers direct registered-pair discovery with `pairPoolIdCount` and indexed `pairPoolIds` reads. The UI validates both token addresses and each key against its pool ID. Bounded pages are pinned to one block and expose partial coverage. Registration is permissionless and does not imply an extension is safe; it also does not cover unregistered Core pools. FreeLP creation registers its selected pool automatically. The new registry starts with its own registrations; previous registry entries are not automatically migrated.

Previous FreeLP NFTs do not migrate when these addresses change. Manage them with a release targeting their original manager. Historical enumeration of burned NFTs and migration between managers are separate capabilities.
