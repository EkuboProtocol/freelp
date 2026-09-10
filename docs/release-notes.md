FreeLP static IPFS deployment and verified local launcher.

Use the descriptor and provenance bundle to verify the exact source and deployed content. `site.car` contains the IPFS application DAG. `release.car` also includes the verification proof, with the app under `site/` and evidence under `proof/`. Import it with `ipfs dag import release.car` to retain the deployment independently. `deployment.json` records both CIDs. Use the independently verified CLI with `--cid RELEASE_CID` to fetch from local Kubo and authenticate the release before opening it.

Private development builds use a GitHub-signed OIDC issuance proof bound to the descriptor digest. Public releases use GitHub/Sigstore build attestations. Neither proves that the software is free of bugs. Network gas and LP risks apply.
