# Requirements audit

- RPC-only EVM LP operations; no swaps, TWAMM, Starknet, hosted metadata or indexers.
- Per-network configurations for Robinhood Chain, Base, Arbitrum, Ethereum, and the supported viem catalog. RPC endpoints are replaceable; arbitrary custom EVM networks are not in scope.
- Bundled token lists and chain-read token imports; local metadata fallback for nonstandard tokens.
- Pool discovery and current liquidity charts from QuoteDataFetcher using interface tick-liquidity math. No historical prices, USD valuation, or global pool ranking is claimed.
- Cross-network owned-position listing, creation, deposits, withdrawals, fee collection, transfer and burn. On-chain ownership and metadata remain authoritative.
- Browser deployment of Core, FreeLP and the combined FreeLPDataFetcher, with shared transaction consent and runtime verification.
- npm distribution with bundled static assets, no runtime dependencies, custom binaries, GitHub attestation, or second application download.
- Per-commit static IPFS artifacts; offline verification and verified Actions artifacts.
- Monochrome styling and retained legal notices. New source MIT; contract/dependency licensing is unchanged.

Free means no application fee or operator service bill. Users still pay chain gas. Public RPC availability and long-term IPFS retention depend on their operators; users can replace RPCs, self-host, and retain CARs.
