import { useSession } from "./session";
import { NetworkSettingSelect } from "./NetworkSettingSelect";
import { Trans } from "@lingui/react/macro";
import { DeploymentCard } from "./DeploymentCard";
import { DEPLOYMENT_SALT, CREATE2_FACTORY } from "./deterministic";
export function DeployPage() {
  const { networks } = useSession();
  if (!networks.length)
    return (
      <p>
        <Trans>Enable a network in Settings to deploy contracts.</Trans>{" "}
        <a href="#/settings">
          <Trans>Settings</Trans>
        </a>
      </p>
    );
  return (
    <section>
      <h2>
        <Trans>Deploy contracts</Trans>
      </h2>
      <p>
        <Trans>
          Deploy missing contracts once for everyone on this network. Addresses
          depend on the fixed salt and contract code, never on your wallet.
          Existing contracts are detected before any deployment.
        </Trans>
      </p>
      <NetworkSettingSelect />
      <DeploymentCard kind="Core" />
      <DeploymentCard kind="FreeLP" />
      <DeploymentCard kind="FreeLPDataFetcher" />
      <details>
        <summary>
          <Trans>Deterministic deployment details</Trans>
        </summary>
        <p>
          <Trans>CREATE2 factory:</Trans> <code>{CREATE2_FACTORY}</code>
        </p>
        <p>
          <Trans>Fixed salt:</Trans> <code>{DEPLOYMENT_SALT}</code>
        </p>
        <p>
          <Trans>
            This build uses fixed contract addresses on every network. Networks
            must provide the standard CREATE2 factory.
          </Trans>
        </p>
      </details>
    </section>
  );
}
