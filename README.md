# FreeLP

Plain, EVM-only, RPC-only liquidity position management. No swap UI, indexer, hosted metadata, API keys, telemetry, or application fee. All authoritative position data and NFT metadata generation are on-chain. The static app runs on IPFS or from a verified local launcher.

Private development: do not publish this repository or its build CIDs until launch readiness. New Solidity lives in the EVM contracts repository; compiled contract artifacts retain their separate licenses.

## Development

Use Bun 1.4.0. `bun install --frozen-lockfile`, `bun run build`, `bun run dev`. The app needs an injected EIP-6963 wallet. Configure the chain RPC and compatible Core/FreeLP manager in Settings, or use Deploy to create them. All transactions require terms acceptance and a separate wallet confirmation.

`bun run test`, `bun run lint`, `bun run check-ts`. Browser tests require Anvil with Osaka support listening on port 18545: `anvil --port 18545 --hardfork osaka --silent`, then `bun run build && bun run test:e2e`. Tests use only public Anvil development keys and freshly deployed local contracts.

## Verified launcher

From a trusted source checkout: `bun cli/main.ts`. Requires GitHub CLI for release discovery and public Sigstore verification. Download and independently verify a packaged CLI before trusting it. Never bootstrap trust using a badge in the candidate web app.

- `--version vX.Y.Z`: explicitly choose an official version.
- `--cid RELEASE_CID --gateway http://127.0.0.1:8080`: fetch an explicit release from local Kubo and verify its outer CID, provenance, and site. Add `--private-build` for private development proof.
- `--offline`: reverify and serve the last cached official release.
- `--bundle PATH --private-build`: verify a downloaded private CI release bundle.
- `--licenses`: print embedded dependency and runtime notices without fetching or launching an app.
- `--no-browser --port 4173`: serve on loopback without launching a browser.

Compiled launchers disable automatic loading of working-directory .env, bunfig.toml, tsconfig.json, and package.json files. CI tests that an untrusted local preload hook cannot execute. The CLI checks repository/workflow identity, source commit, signed artifact digest, every file, and the IPFS CID before serving an in-memory snapshot. GitHub is needed for updates, not for ongoing LP operation. Offline verification cannot discover new revocations. Transactions remain in the user's wallet; the CLI never handles wallet keys.

## IPFS

`bun scripts/package-release.ts SOURCE_COMMIT` creates `release/application.json`, its descriptor, and `release/site.car`. After CI signs the descriptor, `bun scripts/package-proof.ts` creates `release/release.car` and `deployment.json`. The outer directory contains the unchanged app under `site/` and the descriptor, application archive, and proof under `proof/`. The signed descriptor authenticates the inner site CID; the outer CID also binds the proof without a circular signature dependency. The fixed import settings are in `cli/content.ts`. Import either CAR into Kubo to preserve the exact CID. A private offline import does not advertise content publicly.

Each main/tag commit is built and pinned in CI; the complete CAR is retained in a repository release so it can be restored independently. Before launch the repository and releases remain private. After public launch, CI seeds each deployment directly on IPFS from a fresh temporary node. No pinning API, project server, or paid provider is required. CI storage ends with the job; long-lived IPFS availability depends on users retaining the CAR on their own nodes. The repository release also retains the CAR for independent restoration. The CLI defaults to a loopback Kubo gateway for CID selection, rejects gateway redirects, and requires local gateways for private builds. A remote gateway may supply bytes for public releases, but verification still checks every file and both CIDs. Stable version tags are distinct from per-commit prereleases.

To retain an authorized public deployment on your own Kubo node, download `release.car` and run `ipfs dag import release.car`. Keep that node online to serve its pinned content. Before launch, import only with `ipfs --offline dag import release.car` in an isolated repository, and never start that repository online. A content address verifies bytes; it does not pay for or guarantee their permanent storage.

## Licensing

New interface and CLI code are MIT. This independent repository was reduced from the interface checkout and begins with one squashed initial commit. Commit squashing does not change third-party licensing. Contract artifacts and dependencies keep their applicable notices; see THIRD_PARTY_NOTICES.md.

## Rebuilding the launcher runtime

The compiled launcher includes Bun 1.4.0. Its upstream license file and native-library source references are retained in public/licenses/bun-runtime.md and embedded in `freelp --licenses`. FreeLP's source and dependency lockfile are available in this repository.

To use a modified/relinked Bun, follow the upstream Bun/WebKit build instructions in that notice, then compile this application's sources with the rebuilt executable:

```sh
bun build cli/main.ts --compile --compile-executable-path /absolute/path/to/rebuilt/bun --no-compile-autoload-dotenv --no-compile-autoload-bunfig --no-compile-autoload-tsconfig --no-compile-autoload-package-json --outfile .cache/freelp
```

Keep all notice files when redistributing source or binaries. Locally rebuilt binaries do not claim official CI provenance.
