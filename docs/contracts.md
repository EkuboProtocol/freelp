# Contract integration

Source: `EkuboProtocol/evm-contracts` at `042418e50d3fe2486635447f51d7e60d7d23f5fe`. Solidity 0.8.33, Osaka, via-IR, optimizer 9,999,999 runs. The compiler output is imported with source-hash checks and AST-derived immutable roles. Runtime verification binds Core, PoolKeyIndex, and FreeLPMetadataRenderer separately; immutable bytes are never ignored.

| Contract               | Fixed address                                |
| ---------------------- | -------------------------------------------- |
| Core                   | `0x00000000000014aA86C5d3c41765bb24e11bd701` |
| PoolKeyIndex           | `0x827A68AC37AA3715c865F2E0704a63118496986f` |
| FreeLPMetadataRenderer | `0x3E3142aA2143bC05BA92986a9D4867C1409FB8E2` |
| FreeLP                 | `0x0b1605F6ab7CC5A51846cbaCc2A73730C7770c4C` |
| FreeLPDataFetcher      | `0xf4653c16A87828D3901E376eB3578fA50c5bbdD5` |

CREATE2 predictions match the pinned contract repository's DeployFreeLP script. Deploy/reuse Core, PoolKeyIndex, and FreeLPMetadataRenderer before deploying FreeLP. The manager constructor takes those three addresses; the fetcher takes Core. The stateless renderer takes no constructor arguments.

Writes use flat arguments: `maybeInitializePool(key, initialTick)`, `createPosition(key, lower, upper, maxAmount0, maxAmount1, minLiquidity)`, `addLiquidity(id, maxAmount0, maxAmount1, minLiquidity)`, and `withdraw(id, liquidity, recipient)`. Creation and additions require positive minimum liquidity. Withdrawals have no minimum-output arguments; the UI displays estimated receipts and makes this explicit, with slippage controls limited to deposits. The UI retains fresh previews, simulation, exact token caps, and wallet identity checks. Transaction history belongs to the wallet: the application neither persists past requests nor uses them to determine availability.

Every deposit is a payable manager multicall containing the deposit followed by `refundNativeToken()`. Creation prepends an explicit `maybeInitializePool` call, which leaves existing pools unchanged. Native value is attached once to the outer transaction. Refunds must not be separate wallet-batch transactions: a later failure could otherwise leave funds in the manager. The wrapper works with standalone wallet submission and EIP-5792 approval batches alike.

The manager exposes `position(id)` and standard NFT ownership/enumeration. Descriptor, current pool state, and calculated principal/fees are read through FreeLPDataFetcher. Its `ownedPositions` response still contains complete snapshots and embedded metadata. The UI renders validated embedded NFT artwork without fetching image services.

PoolKeyIndex offers direct registered-pair discovery with `pairPoolIdCount` and indexed `pairPoolIds` reads. The UI validates both token addresses and each key against its pool ID. Bounded pages are pinned to one block and expose partial coverage. Registration is permissionless and does not imply an extension is safe; it also does not cover unregistered Core pools. FreeLP creation registers its selected pool automatically. The new registry starts with its own registrations; previous registry entries are not automatically migrated.

Previous FreeLP NFTs do not migrate when these addresses change. Manage them with a release targeting their original manager. Historical enumeration of burned NFTs and migration between managers are separate capabilities.
