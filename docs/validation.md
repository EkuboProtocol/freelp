# Validation record

Development remains private. This is a record of observed checks, not a launch approval.

## Verified on 2026-09-10

- Contract source: EkuboProtocol/evm-contracts commit 577c33f8df83c7af7dcd3d3d17fbf867710f0f29, draft PR #372. Its diff contains only FreeLP sources, types, metadata, tests, documentation, and gas snapshot; complexity tooling is excluded.
- Sixteen targeted Solidity tests pass with 10,000 fuzz runs. Coverage includes packed descriptor roundtrips, uint64 exhaustion, four IDs per storage word, standard enumeration, mint/transfer/burn sequences, settlement, refunds, callbacks, slippage, metadata decoding, and runtime size. Runtime is 24,293 bytes.
- Private app commit 486c488eb6cde0c975c1e6cf0bd0fb6a31dc89ae passed GitHub Actions run 34522369827. The downloaded launcher and application were independently verified against GitHub-signed private provenance.
- That commit's site CID is bafybeie46qzyidfvgpk2cpzuszrswrmv2fkiuyh3cr5cv6d6war5sndf7u. No public IPFS publication occurred.
- The local-chain browser lifecycle deploys Core and manager through the UI, enforces terms before deployment, creates and rediscovers a position after reload, adds liquidity, transfers the NFT out and back, collects, partially and fully withdraws, and burns. Network assertions prohibit nonlocal services and historical log queries.
- Current launcher tests cover private signature/repository/workflow policy, independent roots, content hashes and CIDs, unsafe archive paths, bounded file/gateway reads, redirects, loopback Host/method controls, immutable runtime bindings, exact amount parsing, and complete sorted standard enumeration at one block.
- The outer release package was imported into offline Kubo. The launcher fetched it through a loopback gateway, verified both CIDs and the signed descriptor, and reverified the cached application offline. A valid signed application served under a different requested release CID was rejected before launch.
- Path and subdomain gateway layouts passed browser checks for relative assets, terms deep links/reloads, settings navigation, and no outside network requests. These checks are included in the release workflow.
- Source/dependency scan found no Starknet code or packages.
- The compiled launcher originally executed a working-directory bunfig preload before app verification. Compilation now disables configuration and dotenv autoload; the same adversarial test passes and is part of CI.
- Dependency notices reproduce exactly from a fresh locked install and cover 158 installed runtime packages including transitive dependencies, with supplemental upstream notices and declared-license references for packages omitting license files. Bun runtime/source/relinking notices are retained; the CLI embeds notices behind --licenses.
- The complete browser lifecycle also passes when token decimals calls revert. Amounts are explicitly labeled raw integer units rather than silently assuming 18 decimals.
- Terms browser tests pass with normal and unavailable local storage, stale stored terms, account changes, and cleared storage. Switching accounts resets the checkbox. Unit tests confirm the transaction entrypoint makes no wallet request before acceptance and refuses an account change during gas estimation.
- Pool input tests reject spacing overflow into fee bits and unsupported fee precision before constructing calldata.
- Price inputs convert token decimal scales and round range bounds to valid ticks, with raw ticks and full-range options retained. Previews show chain-derived initialization state, price, and actual bounds. Existing pools ignore the initial-price input. Seventeen unit tests and all four browser tests pass after this change.
- The launcher now preserves existing offline copies during cache repair, separates private/public proof caches, writes selection atomically, and uses immutable version markers with exact integer comparison. Nineteen unit tests pass; an authentic private CI bundle passed initial import, repeated import into the existing cache, and offline verification with the compiled launcher.
- Private app commit 746ffb7fb5bc42d3031ae2a430187a55c065c49c passed complete CI run 34526524892.
- Private tag v0.0.1 at e8e7043740615bf338378046a2d95d90cd73ab48 passed CI 34527494093. Both the locally built launcher and the independently authenticated downloaded launcher verified default latest-release discovery and offline startup; explicit version selection passed too. Site CID: bafybeidzh7wnisiaehnjfrtjv5z5sd3zarmpvmyaybokdjpqo46p2l2yhy.
- Public publication no longer requires a project pin API. The private guard and fresh-public-blockstore command flow pass an isolated test with a mock Kubo executable; configuration commands were also checked against real pinned Kubo offline. Public DHT publication remains intentionally unexecuted while private. Twenty unit tests, lint, typecheck and the production build pass.
- The desktop creation form was visually checked for plain monochrome styling, labeled fields, and the terms gate.

## Limits and remaining checks

The first full contracts run passed 965 tests and failed four existing ExposedStorage tests; the same failures reproduced on the unchanged base with the same seed. Targeted FreeLP tests pass. The current contract PR subsequently passed its full CI run 34522293180: 980 tests passed with gas-snapshot checking enabled, zero failed or skipped.

Private builds use GitHub-signed OIDC issuance evidence with a descriptor-bound audience, because standard private GitHub artifact attestations require an entitlement unavailable to this project. Public Sigstore verification is implemented but still needs a real public release verification exercise before public launch.

After explicit loopback API/gateway bindings were added, release-packaging CI run 34523811210 passed for commit 012eefd31b26bf9c17251634b17a204842e4989e, including verification through offline Kubo and browser gateway checks. Broader RPC/chain failure coverage, CLI rollback/failure integration, and a final usability/requirements audit remain. Stable-release discovery and the latest launcher changes have now been exercised against the private tagged release.
