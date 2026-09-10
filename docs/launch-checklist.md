# Launch checklist

- Review the ownerless FreeLP contracts PR and pinned artifacts; keep unrelated complexity work separate.
- Run lint, typecheck, unit tests, production build, local-chain browser lifecycles, packaged-app check, and offline IPFS gateway checks.
- Review token addresses, canonical deployments, per-network RPC availability, terms, and license notices.
- Keep the EkuboProtocol/freelp repository and all releases private until explicitly ready to launch.
- At launch, authorize public source/IPFS publication, configure supported-chain FreeLP managers, and set up the trusted @ekubo npm publisher. Remove package.json private only as part of authorized publication.
- Publish a tested version; confirm `bunx @ekubo/freelp@VERSION` opens the bundled app. No attestation or separate binary is needed.
- Retain public site CARs on user-operated IPFS nodes. CI's temporary seed is not a permanent pinning service.
