FreeLP 0.1.7 simplifies navigation and position management.

- Ship every page and transaction flow in one JavaScript bundle, reducing IPFS requests.
- Rename Settings to Networks and show the full network catalog with consistent spacing and borders.
- Center wallet connection and position creation in the portfolio empty state; remove position counts and per-network loading messages.
- Show current pool price beside minimum and maximum prices, with a marker on the range.
- Use liquidity and fee summaries with separate Add liquidity and Withdraw dialogs.
- Remove transfer and burn actions. The updated manager automatically burns the NFT and clears its storage when the remaining liquidity is withdrawn.

This release uses new fixed FreeLP and FreeLPDataFetcher addresses, available through the Deploy page. It does not include earlier deployments.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
