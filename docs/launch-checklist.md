# Launch checklist

- Review the ownerless FreeLP contracts PR and pinned artifacts; keep unrelated complexity work separate.
- Run lint, typecheck, unit tests, production build, local-chain browser lifecycles, packaged-app check, and offline IPFS gateway checks.
- Review token addresses, canonical deployments, per-network RPC availability, terms, and license notices.
- Confirm supported-chain deployments and the npm trusted publisher configuration. Releases publish through GitHub CI when a tag is pushed.
- Publish a tested version; confirm `bunx @ekubo/freelp@VERSION` and `npx @ekubo/freelp@VERSION` opens the bundled app. No attestation or separate binary is needed.
- Retain public site CARs on user-operated IPFS nodes. Every successful CI build is pinned on the dedicated DigitalOcean node, with its link attached to the commit.

The persistent DigitalOcean node, signing/deployment keys, and independent IPNS workflow are described in distribution.md. The repository is public with `FREELP_PUBLIC_RELEASE=true`; the IPNS name is published and renewed by automation. Run the IPNS workflow in dry-run mode before dispatching a real publication.
