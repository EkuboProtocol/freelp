FreeLP static IPFS deployment and verified local launcher.

Use the descriptor and provenance bundle to verify the exact source and deployed content. `site.car` contains the IPFS application DAG. Import it with `ipfs dag import site.car` to retain the deployment independently.

Private development builds use a GitHub-signed OIDC issuance proof bound to the descriptor digest. Public releases use GitHub/Sigstore build attestations. Neither proves that the software is free of bugs. Network gas and LP risks apply.
