# npm trusted publishing

`@ekubo/freelp` publishes through GitHub CI with `FREELP_NPM_PUBLISH=true`. The manifest uses `private: false` and `publishConfig.access: public`. Trusted publishing is configured; tagged commits publish with Node 24/npm OIDC and no NPM_TOKEN. On npmjs, the package's trusted publisher is:

| Field | Value |
| --- | --- |
| Organization or user | `EkuboProtocol` |
| Repository | `freelp` |
| Workflow filename | `deploy.yml` |
| Environment name | `npm` |
| Allowed actions | Enable direct `npm publish` |

The GitHub `npm` environment permits tags. The publish job requires the build job to pass, downloads that tag's tested npm tarball, validates its name/version/repository/launch readiness, and publishes it with Node 24/npm OIDC. No NPM_TOKEN is needed. Any pushed tag triggers publication. Set a new, unpublished package version before tagging; tags do not change the package version. Use `v<version>` by convention. Publication updates npm’s `latest` dist-tag. This is the workflow filename containing the publish job, not a separate publish.yml.

`@ekubo/freelp@0.1.1` was published publicly from commit `90ba0a231525416338b797dea393f38529d14649`. Registry access and tarball integrity were verified. The package settings now exist for configuring trusted publishing.

To release, commit the version and changes, then push a tag such as `v0.1.2`. CI builds, checks, and publishes the tested tarball. Verify the registry version and tarball integrity after publication. Do not add an npm write token. Branch builds retain their IPFS previews without publishing to npm.

CI enables npm provenance for public repositories.

References: https://docs.npmjs.com/trusted-publishers/ and https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
