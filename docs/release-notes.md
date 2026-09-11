FreeLP 0.1.9 removes the on-chain deposit-quote endpoint and the blanket reentrancy guard.

Deposit previews and matching token amounts are calculated locally with the Ekubo SDK. Regression tests compare those calculations against simulated deposits rather than a contract quote function. The contract retains the settlement math and limits needed to execute deposits safely.

Withdrawals finalize liquidity, burn empty NFTs and clear storage before Core transfers tokens. Refund callbacks can transfer NFTs or create another position; deposit checks reject extension callbacks that would leave liquidity without an NFT.

The updated FreeLP and FreeLPDataFetcher addresses can be deployed from the Deploy page. Earlier deployments are not included.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
