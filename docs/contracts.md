# Contract integration

Source: `EkuboProtocol/evm-contracts` at `e6da5777296bb470a90e32e9068c0d349c9fa085`. Solidity 0.8.33, Osaka, via-IR, optimizer 9,999,999 runs. The compiler output is imported with source-hash checks and AST-derived immutable roles. Runtime verification binds Core and PoolKeyIndex separately; immutable bytes are never ignored.

| Contract          | Fixed address                                |
| ----------------- | -------------------------------------------- |
| Core              | `0x00000000000014aA86C5d3c41765bb24e11bd701` |
| PoolKeyIndex      | `0x898956fc2Aed01D5F81F556FF5dcB10534285718` |
| FreeLP            | `0xE7483a2F17A0F77480BDAc3bdb27CB002088BaA1` |
| FreeLPDataFetcher | `0x53f94Bf2f022F4E31Be9B336C80555020f6009cD` |

CREATE2 predictions match the pinned contract repository's DeployFreeLP script. Deploy/reuse Core and PoolKeyIndex before deploying FreeLP. The manager constructor takes both addresses; the fetcher takes Core.

Writes use flat arguments: `createPosition(key, lower, upper, initialTick, maxAmount0, maxAmount1, minLiquidity)`, `addLiquidity(id, maxAmount0, maxAmount1, minLiquidity)`, and `withdraw(id, liquidity, recipient, min0, min1)`. There are no deadline arguments. The UI retains fresh previews, simulation, exact token caps, minimum-liquidity/output protection, wallet identity checks, and submitted-request recovery.

Every deposit is a payable manager multicall containing the deposit followed by `refundNativeToken()`. Native value is attached once to the outer transaction. Refunds must not be separate wallet-batch transactions: a later failure could otherwise leave funds in the manager. The wrapper works with standalone wallet submission and EIP-5792 approval batches alike.

The manager exposes `position(id)` and standard NFT ownership/enumeration. Descriptor, current pool state, and calculated principal/fees are read through FreeLPDataFetcher. Its `ownedPositions` response still contains complete snapshots and embedded metadata. The UI renders validated embedded NFT artwork without fetching image services.

PoolKeyIndex offers registered pool discovery by token. Pair results must filter both addresses and validate each key against its pool ID. Bounded pages are pinned to one block and expose partial coverage. Registration is permissionless and does not imply an extension is safe; it also does not cover unregistered Core pools. FreeLP creation registers its selected pool automatically.

Previous FreeLP NFTs do not migrate when these addresses change. Manage them with a release targeting their original manager. Historical enumeration of burned NFTs and migration between managers are separate capabilities.
