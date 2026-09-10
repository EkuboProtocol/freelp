# Third-party notices

FreeLP's new interface and launcher source are MIT. This does not relicense included contracts, dependencies, or the compiled launcher's runtime.

- Core/FreeLP ABI and bytecode retain the [Ekubo DAO Shared Revenue License 1.0](public/licenses/contracts.txt). Solady portions retain their [MIT notices](public/licenses/solady.txt). Contract metadata records source hashes and component license identifiers.
- [Runtime dependency notices](public/licenses/dependencies.txt) include the installed transitive dependency graph, original license files, declared licenses, and author metadata. This is a conservative superset of code retained by the bundlers. Missing package license files are supplemented from upstream sources recorded in scripts/license-supplements.json; standard license texts are identified separately when upstream provides only a license declaration. No dependency is represented as newly licensed by FreeLP.
- Compiled launcher binaries include Bun 1.4.0 and its native components, with the [upstream license and component/source references](public/licenses/bun-runtime.md). Source: https://github.com/oven-sh/bun/tree/bun-v1.4.0. Those components retain their own licenses, including JavaScriptCore's LGPL terms. The application and launcher sources needed to rebuild FreeLP are in this repository. A custom rebuilt Bun runtime can be used with Bun's `--compile-executable-path` option; see README.md.

Generate dependency notices after a locked install with `bun scripts/notices.ts`; CI checks them with `bun run notices:check`. Review license changes when updating dependencies.
