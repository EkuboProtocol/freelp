# Bundled token defaults

The token picker uses the native currency (zero address) from viem plus bundled metadata for each supported chain. Address-based custom token imports remain supported. No hosted logos, supply data, token API, or download from any other service is involved.

The metadata ships inside the app as `tokens/<chainId>.json` (source: `public/tokens/`), one file per chain, and is fetched from the app's own origin the first time a chain's tokens are needed rather than compiled into the script bundle. That keeps startup fast while carrying thousands of entries; the create page waits for the current chain's file before rendering the picker.

`bun scripts/sync-default-tokens.ts` regenerates the files from `https://prod-api.ekubo.org/tokens?chainId=<id>`, keeping every token with `visibility_priority >= 0` except the chain's wrapped native token (Ekubo pools use the native currency directly). Only address (checksummed), symbol, name, and decimals are retained; tokens bundled earlier but absent from the API are kept. `--check` fails when the files are stale. The endpoint returns at most 1000 tokens per chain without pagination, so Ethereum, Base, Arbitrum, BNB Smart Chain, and Polygon carry the first 1000 by visibility priority and sort order.

Last sync: 2026-09-14 UTC. Counts excluding native currency: Ethereum 1003, Base 998, Arbitrum 998, Robinhood 976, Optimism 893, BNB Smart Chain 998, Gnosis 465, Unichain 332, Polygon 998, Monad 223, Ink 655. The metadata reflects the API, not asset safety or available pool liquidity.
