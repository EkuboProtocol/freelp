FreeLP 0.1.4 improves position management:

- Only mark enabled networks unavailable after confirming their contracts are deployed.
- Calculate matching deposit amounts immediately with the Ekubo SDK, sharing cached balance and allowance reads with the token picker.
- Use 25%, 50%, and 100% balance shortcuts.
- Show persistent notifications as dismissible toasts.
- Stack both token amounts in each liquidity-chart bucket.
- Query wallet batching support for the selected chain and hide separate approvals when approve-plus-deposit batching is available.

Run `bunx @ekubo/freelp@latest` or `npx @ekubo/freelp@latest`.
