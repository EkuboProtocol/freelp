# npm trusted publishing

The GitHub side is prepared for `@ekubo/freelp`. The maintainer authorized public npm publication after the pool-flow fixes pass verification. The source repository stays private. The manifest uses `private: false` and `publishConfig.access: public`; there is no npm `public: true` setting. Automated publication remains disabled with `FREELP_NPM_PUBLISH=false` until trusted publishing is configured.

On npmjs, open https://www.npmjs.com/package/@ekubo/freelp/access and add a GitHub Actions trusted publisher:

| Field | Value |
| --- | --- |
| Organization or user | `EkuboProtocol` |
| Repository | `freelp` |
| Workflow filename | `deploy.yml` |
| Environment name | `npm` |
| Allowed actions | Enable direct `npm publish` |

The GitHub `npm` environment only permits `v*` tags. The publish job requires the build job to pass, downloads that tag's tested npm tarball, validates its name/version/repository/launch readiness, and publishes it with Node 24/npm OIDC. No NPM_TOKEN is needed. The tag must equal `v` plus the package version. This is the workflow filename containing the publish job, not a separate publish.yml.

`@ekubo/freelp@0.1.1` was published publicly from commit `90ba0a231525416338b797dea393f38529d14649`. Registry access and tarball integrity were verified. The package settings now exist for configuring trusted publishing.

Publish the verified current tarball with `npm publish <tarball> --access public --ignore-scripts --provenance=false` using interactive maintainer authentication. Verify the registry version and tarball integrity after publication, then configure the trusted publisher above. Do not add an npm write token. Enable `FREELP_NPM_PUBLISH=true` only after that setup; future version tags can then publish through CI.

The repository may remain private. npm provenance is enabled only when the source repository is public, because npm does not support provenance for private source repositories. Trusted publishing authentication itself works independently of that limitation.

References: https://docs.npmjs.com/trusted-publishers/ and https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
