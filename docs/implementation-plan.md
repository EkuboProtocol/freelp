# FreeLP: RPC-only LP interface implementation plan

Status: implementation in progress, 2026-09-10. Private repository: moodysalem/freelp. Contract PR: EkuboProtocol/evm-contracts#372. Public application publication remains disabled.

## Outcome and privacy

Build FreeLP, a minimal EVM liquidity-position application derived from EkuboProtocol/interface, in a new private repository provisionally named freelp. The user explicitly permits a new repository. Keep its source, CI artifacts, previews, and deployment bundles private until launch readiness. After removing unnecessary code, squash the imported history and cleanup into one initial root commit in the new repository; preserve the original upstream repository unchanged and record provenance privately. Subsequent development uses normal commits. Verify repository visibility before pushing. Work in dedicated git worktrees; keep shared checkouts clean.

Target an MIT license for the interface, subject to rights to retained source and assets. Squashing does not change copyright or licensing obligations. No repository LICENSE was found in the inspected interface checkout; its bundled website terms assert Ekubo, Inc. ownership but are not an open-source grant. Establish authority to license retained first-party code, audit third-party code/assets/dependencies, preserve required notices, and remove or replace incompatible material. Keep contracts and bundled contract artifacts under their applicable licenses; do not represent the entire distribution as exclusively MIT if it includes separately licensed components.

All new Solidity source, interfaces, tests, and deployment scripts belong in a PR to EkuboProtocol/evm-contracts. That PR may be public, but must not contain private interface source, screenshots, or launch details. Publishing the interface or uploading its bundle to public IPFS is a separate release action after readiness. An unadvertised CID does not provide privacy; development IPFS tests must use an isolated local node without public peers or announcements.

## Scope

Keep: wallet connection, owned position list, position creation, pool initialization when needed, adding liquidity, partial/full withdrawal, fee collection, NFT transfer, RPC settings, and permissionless deployment/configuration.

Initial scope: the current EVM Core version and extension-free concentrated-liquidity pools, including full-range positions. This project is EVM-only; no Starknet code, dependencies, configuration, or wallet integrations are included. Existing older managers, stableswap-specific UI, TWAMM pools, boosted/reward extensions, and migration are outside the initial release. The underlying Core can still support swaps; this application provides no swap execution or order interface.

Delete swaps, TWAMM orders, routing/quotes, bridges, zaps, governance, incentives, rewards, campaigns, USD valuation, APR, historical charts, transaction-history indexing, global pool rankings, hosted token search, remote NFT metadata, analytics, telemetry, geolocation, server functions, and service-dependent wallet connectors. Retain transaction receipts/status for transactions initiated in the current browser.

Free means zero recurring operating cost to the project, zero application/position-manager fees, and no paid APIs, subscriptions, API keys, or required backend. Design for indefinite operation without project-operated servers or ongoing intervention. Network gas remains payable. Public RPCs are third-party infrastructure; make them replaceable defaults, with a self-hosted RPC option. IPFS availability requires someone to retain and serve the content. Continued operation depends on the chain, compatible wallets, and content availability, rather than a project subscription or server.

## Findings from the current code

- Interface baseline: c0197fdd19e49d4582ab9a95b1c7458739159056.
- Contracts PR base: 3aff3503db32ef6df4e748fcaec0d2bf05d7a165 (complexity changes excluded).
- FreePositions returns zero swap-protocol and withdrawal fees, but inherits owner-controlled NFT metadata and accepts an owner constructor argument.
- BasePositions already reads current liquidity, principal, and uncollected fees from Core through getPositionFeesAndLiquidity. Its callers must supply the NFT ID, PoolKey, and tick bounds.
- The interface fetches tokenURI over HTTP to recover position configuration, and uses APIs for ownership/discovery and much of its surrounding LP presentation.
- Existing NFTs can contain multiple pool/range positions. Existing deposit and burn entrypoints are not virtual, so simply adding a derived convenience method cannot enforce indexing or lifecycle rules across all inherited entrypoints.
- Vite currently assumes server-side RPC proxies and includes Cloudflare Functions. A static build alone does not remove those dependencies.

## 1. Ownerless, self-describing positions contract

Add a standalone FreePositions-derived implementation, named FreeLP, without changing existing production contracts or their source dependency graph. Preserve proven Core accounting and payment behavior through a focused adaptation; document intentional differences in the PR.

Use exactly one immutable PoolKey and tick range per NFT. This simplifies enumeration, transfer, burn checks, and rendering. Store that descriptor at creation and require every deposit/withdraw/collect path to use it. Reject unsupported extensions in this initial implementation. Keep pool initialization permissionless and separate from the immutable Core reference.

Implement the ERC-721 Enumerable and Metadata standards, maintaining owner and global token indexes with constant-time updates on mint, transfer, and burn. List all owned tokens and sort by token ID in the client, without pagination controls. Batch RPC reads to respect endpoint limits. Transfer-to-self and safe-transfer callbacks must preserve indexes. Return descriptors directly through RPC; do not reconstruct them from events or duplicate live balances/fees already stored in Core. Read counts, token indexes, descriptors, and balances at the same block number for a consistent snapshot.

Deploy with no administrator, fee setter, upgrade mechanism, mutable metadata service, or ownership-acquisition path. Provide fixed collection identity and mandatory fully on-chain NFT metadata generation: tokenURI returns a data:application/json URI whose image is an embedded data:image/svg+xml URI. Generate the JSON, attributes, and SVG from on-chain position descriptors and contract state, with no HTTP/IPFS image or metadata fetch, external fonts, or hosted renderer. An immutable renderer contract is acceptable if needed for bytecode size and must be bundled into the permissionless deployment flow. Handle token metadata failures and escape untrusted token strings correctly for JSON and SVG; cap external read gas and returned data. Prefer address-based fallback labels. Test tokenURI for nonexistent/burned IDs, long or malicious token symbols, and contract size/gas limits. Keep zero fee calculations explicit. Prevent burns while principal or collectible fees remain. Define clean burn/remint semantics if deterministic salts are retained.

All authoritative application data that can reasonably live on-chain must live there: ownership, position descriptors, contract bindings, and NFT metadata generation. Read or compute current balances, fees, and prices from existing chain state rather than duplicating it. RPC URLs and personal preferences remain local bootstrap settings; browser caches are disposable. No essential data may depend on a browser's history, a project-operated database, an indexer, or off-chain metadata. No global deployment registry is required: deployment configuration is validated against on-chain contract bindings, and users can import manager addresses.

Preserve NFT authorization, recipient selection, token ordering, native-token refunds, and atomic multicalls. Add enforceable withdrawal minimum amounts/deadlines where needed; transaction previews alone are not slippage protection. Validate deposit bounds and rounding as well as withdrawals. Reentrancy and enumeration must be correct across all externally reachable methods, including callbacks and batching.

Expose pool state through a bounded getter on the new contract or reuse direct Core storage reads. Avoid making a separately deployed lens or Multicall3 a prerequisite. Compare added storage gas and bytecode size against FreePositions.

## 2. Private interface reduction

Keep reusable React styling, token math, amount inputs, range controls, and EVM transaction utilities where they remain useful. Replace the large API-dependent LP pages with small RPC-only pages; remove unused routes, hooks, dependencies, assets, environment variables, and CI integrations. Follow repository localization and complexity rules; use the React performance skill during implementation.

### Plain, unbranded presentation

Remove inherited branding throughout the website and code: logos, branded favicons, illustrations, promotional pages/copy, brand fonts, colors, social/marketing links, branded NFT artwork, unused branded assets, package descriptions, page titles, manifests, and social-preview metadata. Rename app-specific packages and identifiers to neutral FreeLP names where appropriate. Use FreeLP only as a plain text project identifier; do not introduce a new visual brand. Preserve required copyright/license notices, technical provenance, and external ABI/protocol identifiers necessary for interoperability. No token logos; use text symbols and addresses.

Use a black-and-white interface with neutral grays, system fonts, simple borders, compact functional layouts, and no gradients or decorative motion. Distinguish errors, pending states, disabled controls, selected tabs, and success using explicit text, shape, weight, and patterns rather than color alone. Maintain readable contrast, visible keyboard focus, and accessible form labels. Match the fully on-chain NFT SVG to this same plain style, showing useful position information without logos or remote assets.

Data requirements:

| UI data                                  | Source                                   |
| ---------------------------------------- | ---------------------------------------- |
| Owned NFT IDs and pool/range descriptors | Standard ERC-721 Enumerable getters            |
| Liquidity, principal, uncollected fees   | Manager/Core eth_call                    |
| Spot price and pool initialization state | Core state through RPC                   |
| Token metadata, balances, allowances     | ERC-20 calls; native-token chain config  |
| Token choices                            | Bundled minimal list plus address import |
| Pending transaction status               | Wallet response and RPC receipts         |

Missing/nonstandard ERC-20 metadata must fall back to addresses and explicit user-supplied decimals, not a hosted lookup. Bundle fonts/icons/token assets locally. Show token-denominated amounts and pair prices only. Users select token addresses, fee, tick spacing, range, and initial price for new pools; no global pool discovery is necessary.

Use injected EIP-1193 wallets with EIP-6963 discovery. Remove WalletConnect relays, hosted wallet onboarding, paymasters, and remote connector assets. Wallets may use their own infrastructure internally; the application cannot control that.

### Terms and transaction consent

Bundle versioned Terms of Service in the static application, with an always-accessible terms page and explicit acceptance before any transaction. Proposed core wording: "Use FreeLP at your own risk. You may lose some or all of your funds. Transactions can be irreversible. FreeLP is provided as is, without warranties. You are responsible for reviewing the network, contracts, tokens, amounts, permissions, and transaction details before signing." Include an appropriately qualified limitation-of-liability provision; do not claim that accepting the terms guarantees enforceability or eliminates all liability. Keep these app-use terms distinct from the MIT software license and its warranty/liability disclaimer, and avoid restrictions on the software freedoms granted by MIT.

Show an unchecked checkbox stating "I have read and agree to the Terms of Service and understand that I use FreeLP at my own risk", with a direct link to the complete bundled terms and a deliberate acceptance button. Reading positions, configuring RPCs, and connecting a wallet remain available without acceptance. Declining or closing the prompt must not invoke a transaction request. Accepting must not itself submit the pending transaction: return to the transaction review for a separate confirmation.

Enforce acceptance at a shared transaction execution boundary, not just disabled buttons. Cover ERC-20 and NFT approvals, pool initialization, position creation/deposits, fee collection, withdrawals, transfers, burns, refunds, multicalls, wallet batch calls, and every contract deployment step. Gate any asset-authorizing signatures if such flows are introduced. Recheck immediately before invoking the wallet, including after asynchronous simulation/estimation and when resuming a deployment. Maintain a terms-content version/hash; acceptance is scoped to that version and the connected wallet address. Changed terms or a new account require explicit acceptance. Never import acceptance from a share link or deployment configuration.

Store the acceptance version/hash, wallet address, and timestamp locally, with session-memory fallback when storage is unavailable; no backend, tracking request, gas payment, or on-chain acceptance transaction is required. This is local UI consent state, not authoritative position data or a cryptographic proof of assent. Clearing storage or using a new gateway origin requires acceptance again. The gate governs this application; ownerless contracts remain callable directly and independently developed forks control their own UI.

## 3. RPC settings and permissionless deployment

Offer configurable per-chain RPC endpoints, connection/chain-ID testing, explicit endpoint switching, bounded reads, caching, and rate-limit backoff. Never silently fall back to an unconfigured provider. Validate no-key public defaults against actual supported chains at release time, including browser CORS and real contract calls. Existing source lists PublicNode/1rpc endpoints as candidates, not verified release commitments.

Namespace cached data by chain ID, Core, manager address, account, and endpoint as appropriate. Clear incompatible state on changes. Support export/import of non-secret deployment configuration. Warn before exporting URLs containing credentials; do not embed private RPC URLs in share links.

Provide a dedicated deployment page with two explicit choices: deploy a manager against a compatible existing Core, or deploy a fresh Core plus the manager. Fresh Core means isolated liquidity. Bundle pinned compiler artifacts locally; never use a browser compiler service, explorer API, or hosted deployment service. Validate chain/EVM compatibility, estimate gas, show constructor values, obtain wallet signing, wait for receipts, and verify deployed runtime code with immutable-aware checks plus the Core binding. Recover gracefully from partial deployment and persist confirmed addresses. No owner parameter or admin dashboard.

Deploying from the page is an end-user capability; implementing it does not authorize this development session to spend funds on production deployment.

## 4. Static IPFS release

Use hash routing, relative asset paths, bundled assets/catalogs/ABIs/bytecode, and no runtime server or build secrets. Remove Cloudflare Functions/proxies and provider-specific deployment requirements. Every commit pushed to FreeLP triggers checks, a static build, and IPFS add/pin after checks pass; do not cancel earlier commit builds in favor of newer commits. Record commit SHA to CID mappings, compiler/tool versions, artifact hashes, and contract addresses. Failed builds report failure instead of publishing a broken deployment. Do not rewrite a bundle's contents after computing its CID.

Before launch, deploy each successful commit to isolated private IPFS infrastructure without public DHT/provider announcements or public gateways. Keep CI logs and artifacts private. After launch, publish each successful commit from a fresh temporary CI IPFS node and retain its pinned CAR in the repository release. Users can import and retain that CAR independently; no project pin service is required. This replaces Cloudflare deployment entirely. Historical prelaunch CIDs stay private unless explicitly included in the release. Provide documented Kubo add/pin instructions with fixed CID options so anyone can reproduce and retain builds. The application has no dependency on the continued operation of this CI/pinning runner; private CI and retained per-commit pins still require storage/compute resources.

Test path-style and subdomain gateway URLs, deep-link reloads, and multiple copies of the same bundle. Prefer subdomain gateways for origin isolation. Settings are origin-local; exporting/importing configuration must make changing gateways or release CIDs practical. Use local-only static/IPFS hosting until release.

### Repository-specific build provenance

Every deployed build must carry a cryptographically verifiable GitHub Actions provenance attestation. The verifier policy must pin the final exact FreeLP owner/repository, repository identity where available, approved workflow path/identity, source commit, and permitted refs/events. A valid signature from some GitHub repository is insufficient. Distinguish CI-authenticated development commits from launch-ready releases; a build passing CI does not itself mean it is approved for launch or safe from bugs.

Build the static application once, compute a canonical manifest of every served application file (including entry HTML, scripts, CSS, local assets, terms, and contract artifacts), and create the site IPFS DAG/CID using fixed import settings. Generate and attest a detached release descriptor binding that site CID, manifest digest, artifact digest, source SHA, and CI identity. Package the unchanged site under a site/ directory alongside the descriptor and Sigstore verification bundle in an outer IPFS release directory. The attestation covers the inner application CID; it does not try to include itself or the outer wrapper CID in its own digest. Publish the outer CID and the authenticated inner site CID with a documented verification procedure. Test the relative-path layout and proof discovery explicitly.

Use GitHub OIDC-backed artifact attestations, with full signature/certificate/identity and applicable timestamp/transparency-proof verification, not unsigned build-info JSON or an arbitrary CI-held signing key. Pin Actions to commit SHAs, restrict workflow permissions, and ensure fork PRs/untrusted workflow changes cannot mint an official release identity. Select a maintained verifier implementation; prototype browser compatibility and offline verification before committing to a browser implementation. Verify current private-repository attestation entitlement before setup; do not introduce a paid plan silently. Private provenance bundles must remain private and must not be submitted to a public transparency log before launch. If the free private CI environment cannot provide this attestation, record that concrete infrastructure constraint and resolve it before claiming private builds are authenticated.

Expose a plain Build details view with repository, commit, workflow/run, site CID, and a precise provenance status. Verification must use the actual application bytes/DAG, not merely compare a claimed CID in the address bar; reject missing files, changed HTML/assets/bytecode, wrong repo/workflow/ref, substituted trust roots, and mismatched descriptors. Ship a separately obtainable offline verification tool/instructions and authenticated trust-root material so verification does not require a live GitHub or Sigstore API during normal use. A trust root provided solely by the untrusted candidate build is not an independent trust anchor. Root refresh/revocation knowledge may require an explicit later update; label offline verification accordingly.

An in-page badge is diagnostic, not a bootstrap trust guarantee: arbitrary JavaScript can lie about its own verification. The strong user path is an independently trusted local verifier/launcher (or independently installed browser verifier) that checks provenance and IPFS content integrity before serving/executing the app. The local verifier can serve verified files using a local static server/Kubo gateway and then use only the configured chain RPC. A remote HTTP gateway is otherwise still trusted to deliver the entry HTML/verification code. Include this limit in the Build details documentation without suggesting provenance proves contract safety. GitHub/Sigstore are build-time provenance authorities; retain verifiable bundles so their runtime availability is not required. Do not introduce an administrator-controlled on-chain release registry or per-commit gas costs merely to mirror CI metadata.

### FreeLP CLI: recommended trusted launch path

Implement a small CLI in the new private FreeLP repository. Default command: `freelp` resolves the latest non-draft, non-prerelease official GitHub release from the pinned repository, downloads the release descriptor/attestation and referenced application content, verifies them independently, starts a loopback-only static server, and opens the browser only after verification succeeds. Do not treat the newest CI commit as the latest release: every passing commit has an IPFS deployment, but stable releases are explicitly designated. Release discovery uses GitHub at launch/update time; the running application remains RPC-only.

The CLI owns the verification policy and trust roots, independently of the downloaded app. Require the exact official repository and approved release workflow identity, verify that the attested commit matches the release/tag under the release policy, validate the complete signed file manifest and IPFS DAG/CID, and serve only the verified application tree. GitHub release metadata and download URLs locate candidates; they do not authenticate bytes. Treat release content as untrusted until verification finishes. Fetching from a gateway, local Kubo, or a cache must produce the same verified content. Use maintained attestation/IPFS verification libraries or an explicitly managed verification dependency; do not implement new cryptography.

Download into a staging directory with size limits; reject path traversal, symlinks escaping the application root, unexpected executable hooks, and files outside the authenticated manifest. Promote successfully verified content atomically into a cache keyed by authenticated digest/CID. Serve an immutable verified snapshot to avoid verification-to-serving races, with no directory listing or access to unrelated local files. Bind only to loopback, validate Host, and prevent browser requests from invoking CLI update/filesystem/command operations. Browser opening must not interpolate untrusted shell commands. Support an explicit no-browser option for headless use.

Provide explicit version/CID selection with the same official provenance policy, and an offline mode that re-verifies cached content and bundled evidence without contacting GitHub or Sigstore. First launch needs a release download or a complete imported release bundle plus independently trusted verifier policy. If update discovery is unavailable, report that freshness cannot be established and offer the cached verified release; never call it the latest. If a downloaded candidate fails verification, fail closed and never silently launch it or mark it trusted. Remember the highest previously accepted official release to detect unexpected rollback; permit older versions only through explicit version selection. Offline use cannot promise knowledge of newer releases or trust-root revocations.

Keep a stable localhost origin when safely available so RPC settings and versioned terms acceptance can persist; refuse to reuse a port owned by an unrelated process. If the origin changes, explain the need to reimport settings/reaccept terms. Keep the CLI running while it serves the app, with graceful explicit shutdown; do not stop unrelated daemons or sessions. Do not hot-swap application files under an open transaction flow. The CLI must never request wallet keys, sign transactions, or provide a transaction proxy.

Distribute versioned CLI artifacts with their own provenance and documented independent initial verification; avoid an unverified curl-to-shell bootstrap. Publish reproducible build instructions. The user must establish trust in the initial CLI/verifier through an independently obtained official release/verification procedure—an app and CLI cannot establish that trust by asserting it about themselves. CLI updates require their own verification policy and cannot replace trust roots from an unverified application bundle. Private development release access may use existing local GitHub authentication but must never expose credentials to the served browser app. Choose implementation language and supported binary targets after checking the smallest reliable maintained offline verification stack.

## 5. Acceptance gates and deliverables

Contracts: unit/fuzz/invariant tests for owner enumeration, safe transfers, authorization, descriptor immutability, all mutation entrypoints, empty/partial/full withdrawals, fee collection, burn/remint, native/ERC-20 settlement, callbacks, slippage, multicall, and fully on-chain JSON/SVG metadata generation. Run forge fmt, forge build --offline, forge test --offline, and forge snapshot --offline before committing/pushing. Test against an existing compatible Core and a fresh deployment.

Interface: lint, typecheck, relevant math/transaction tests, English catalog extraction, and production build. Browser end-to-end tests must create, reload/discover, add, collect, partially withdraw, fully withdraw, and transfer positions using the real compiled contracts on a local chain. Test RPC/chain/account switching, provider failures, missing token metadata, large complete portfolios without pagination controls, and custom deployment recovery.

Consent tests: assert zero transaction/asset-authorization wallet requests before acceptance across every execution path, including deep links, keyboard submission, multicalls, deployment recovery, and account changes during simulation. Test decline/close, stale terms, changed accounts, cleared/unavailable storage, and renewed acceptance. Verify read-only access remains available and the terms page loads with external network access blocked.

Provenance tests: verify an authentic offline build; reject a fork-repository attestation, disallowed workflow/ref, modified HTML/script/asset/contract bytecode, forged descriptor, wrong site CID, missing proof, and attacker-supplied trust roots. Verify the independent launcher rejects modifications before executing any application code. A second clean build must reproduce the application CID; attestations and CI run metadata live outside those deterministic application bytes. Visual checks must confirm the monochrome, unbranded interface and NFT artwork, with accessible focus and non-color status cues.

CLI tests: latest stable release selection; verified download and browser launch ordering; offline cached startup; unavailable release discovery; corrupted cache; release/commit mismatch; rollback handling; interrupted downloads; hostile archive paths and oversized content; port conflicts and Host validation; isolation from local files and GitHub credentials; and no content replacement during an active session. Verify a running app continues to function when GitHub and all non-RPC remote services are blocked.

Enforce a browser network allowlist: only locally served static assets, explicitly configured RPC endpoints, and injected wallet calls. Fail on API/indexer/metadata/telemetry/relay calls. Start from an empty browser profile and disable historical log queries to prove indexer-free recovery. Exercise wallet behavior in a secure gateway context.

Deliver: private FreeLP repository containing the interface and trusted-launch CLI, reproducible static bundle and CLI artifacts with provenance; EVM contracts PR with tests, gas/storage costs, ABI/artifacts and deployment instructions; local validation report; launch checklist and publication-ready IPFS commands. No public interface or CLI publication before readiness.

## References

- Local code: src/FreePositions.sol, src/base/BasePositions.sol, src/base/BaseNonfungibleToken.sol, src/lens/CoreDataFetcher.sol in evm-contracts; src/hooks/evm/useTokenMetadata.ts, src/pages/evm/EvmManagePosition.tsx, vite.config.ts in interface.
- JSON-RPC capabilities: https://ethereum.org/developers/docs/apis/json-rpc/
- Self-hosted nodes: https://ethereum.org/developers/docs/nodes-and-clients/
- IPFS static hosting: https://docs.ipfs.tech/how-to/websites-on-ipfs/single-page-website/
- Gateway origin isolation: https://docs.ipfs.tech/concepts/ipfs-gateway/
- MIT notice requirements: https://opensource.org/license/mit
- Unlicensed source: https://choosealicense.com/no-permission/
- GitHub provenance: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- Offline attestation verification: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline
- Repository/workflow verification policy: https://cli.github.com/manual/gh_attestation_verify
