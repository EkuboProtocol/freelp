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

The package must exist before its package settings can be configured. The maintainer authorized a restricted bootstrap publish before launch. Version `0.1.1` was prepared from the verified build at `783a04ee0f6278ea6e63c93a83659c03b4b023ca`, with `publishConfig.access: restricted` and provenance disabled. The interactive publish has not completed: npm's web authentication expired. Do not treat an access-status response of `private` as proof that a version was published; verify the authenticated registry version and tarball integrity after publishing.

Finish that restricted bootstrap using the maintainer's interactive npm authentication, then configure the trusted publisher above. Keep the source manifest private and `FREELP_NPM_PUBLISH=false` during private development. No npm write token is needed.

At public launch, explicitly change the package visibility, remove `private: true` from the source manifest, and increment the version above the private bootstrap version. Build and test before tagging. After trusted publishing is configured and public launch is authorized, set `FREELP_NPM_PUBLISH=true`; future `v*` tags publish publicly only after verification. npmjs may require login and 2FA for setup or first publication.

The repository may remain private. npm provenance is enabled only when the source repository is public, because npm does not support provenance for private source repositories. Trusted publishing authentication itself works independently of that limitation.

References: https://docs.npmjs.com/trusted-publishers/ and https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
