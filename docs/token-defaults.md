# Bundled token defaults

The token picker uses native ETH (zero address) and a local metadata snapshot. WETH is not a default: Ekubo accepts native ETH directly. Address-based custom token imports remain supported.

The snapshot comes from EkuboProtocol/default-tokens `curated-tokens.json` at commit d1128b1bca85da405674686400afae017337e5a7, restricted to Ethereum, Base, Arbitrum, and Robinhood Chain. Only addresses, names, symbols, and decimals are retained. No hosted logos, supply data, token API, or runtime list download is included.

Counts including native ETH: Ethereum 37, Base 4, Arbitrum 10, Robinhood 98. Robinhood includes USDG and its curated tokenized assets. Base also includes EURC and cbBTC, with addresses from [Circle](https://www.circle.com/blog/eurc-is-coming-to-base) and [Coinbase](https://www.coinbase.com/cbbtc).

All 145 ERC-20 entries had symbol and decimals checked against live chain RPC responses on 2026-09-11 UTC. Base cbBTC was retried successfully through PublicNode after the default RPC failed. Arbitrum's former USDT entry now reports USD₮0; its searchable name includes USDT0. This validates metadata, not asset safety or available pool liquidity.

The seven additional mainnets use the same metadata-only snapshot format, sourced from EkuboProtocol/default-tokens commit `c407db09e64ce9a7d2fbaac521fd860f6ecb5ff6`. Wrapped native tokens are omitted; native BNB, XDAI, POL, MON, or ETH appears at the zero address as appropriate. No testnet lists are bundled.
