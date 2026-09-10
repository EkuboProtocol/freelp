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
- The complete browser lifecycle also passes when token decimals calls revert. Amounts are explicitly labeled raw integer units rather than silently assuming 18 decimals.
- Terms browser tests pass with normal and unavailable local storage, stale stored terms, account changes, and cleared storage. Switching accounts resets the checkbox. Unit tests confirm the transaction entrypoint makes no wallet request before acceptance and refuses an account change during gas estimation.
- Pool input tests reject spacing overflow into fee bits and unsupported fee precision before constructing calldata.

## Limits and remaining checks

The first full contracts run passed 965 tests and failed four existing ExposedStorage tests; the same failures reproduced on the unchanged base with the same seed. Targeted FreeLP tests pass. The full PR CI run must be checked independently.

Private builds use GitHub-signed OIDC issuance evidence with a descriptor-bound audience, because standard private GitHub artifact attestations require an entitlement unavailable to this project. Public Sigstore verification is implemented but still needs a real public release verification exercise before public launch.

The first release-packaging CI run reached the offline gateway check, then failed because the test profile did not bind its expected ports. The workflow now explicitly binds loopback API/gateway ports; the correction requires a successful CI run. Broader RPC/chain failure coverage, CLI stable-release/rollback integration, dependency notice review, and a final usability/requirements audit remain.
