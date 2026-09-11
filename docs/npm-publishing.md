# npm trusted publishing

The GitHub side is prepared for `@ekubo/freelp`. Publishing remains disabled during private development: repository variable `FREELP_NPM_PUBLISH=false` and package.json `private: true` both block publication.

On npmjs, open https://www.npmjs.com/package/@ekubo/freelp/access and add a GitHub Actions trusted publisher:

| Field | Value |
| --- | --- |
| Organization or user | `EkuboProtocol` |
| Repository | `freelp` |
| Workflow filename | `deploy.yml` |
| Environment name | `npm` |
| Allowed actions | Enable direct `npm publish` |

The GitHub `npm` environment only permits `v*` tags. The publish job requires the build job to pass, downloads that tag's tested npm tarball, validates its name/version/repository/launch readiness, and publishes it with Node 24/npm OIDC. No NPM_TOKEN is needed. The tag must equal `v` plus the package version. This is the workflow filename containing the publish job, not a separate publish.yml.

The package must exist before its package settings can be configured. A public unauthenticated registry lookup returned 404 on 2026-09-11; that does not distinguish a missing package from an inaccessible private package. If it already exists privately, its owner can configure the publisher now. Otherwise, bootstrap the first real version interactively at launch, then configure its trusted publisher for subsequent releases. Do not publish a placeholder or change visibility merely to complete setup before launch.

At launch, remove `private: true`, increment the version, build and test, then perform the first authenticated publish as an @ekubo maintainer. Keep `FREELP_NPM_PUBLISH=false` for that bootstrap tag to avoid a duplicate CI publish. After trusted publishing is configured, set it to `true`; future `v*` tags publish automatically only after verification. npmjs may require login and 2FA for setup/first publication. The development browser encountered a human-verification challenge and did not submit npm settings.

The repository may remain private. npm provenance is enabled only when the source repository is public, because npm does not support provenance for private source repositories. Trusted publishing authentication itself works independently of that limitation.

References: https://docs.npmjs.com/trusted-publishers/ and https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
