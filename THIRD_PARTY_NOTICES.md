# Third-party notices

FreeLP's interface and CLI source are MIT. Included contracts and dependencies retain their own licenses.

- Core, FreeLP, and data-fetcher ABI/bytecode retain the [Ekubo DAO Shared Revenue License 1.0](public/licenses/contracts.txt). Solady portions retain their [MIT notices](public/licenses/solady.txt). Artifact metadata records component licenses and source hashes; artifacts/source.json pins the contracts commit.
- Liquidity reconstruction, QuoteDataFetcher decoding/ABI, fee presets, and canonical configuration are reused or adapted from EkuboProtocol/interface. Source comments identify the original modules.
- [Dependency notices](public/licenses/dependencies.txt) retain original licenses and author metadata. This is a conservative superset of code retained by the bundler. Missing license files are supplemented from upstream references in scripts/license-supplements.json. No third-party dependency is represented as newly licensed by FreeLP.
- Bun is a separately installed prerequisite; the npm package does not distribute Bun or a compiled launcher runtime.

After a locked install, regenerate notices with `bun scripts/notices.ts`; CI checks them with `bun run notices:check`.
