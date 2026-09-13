import { useSession } from "./session";
import { NetworkSettingSelect } from "./NetworkSettingSelect";
import { DeploymentCard } from "./DeploymentCard";
import { DEPLOYMENT_SALT, CREATE2_FACTORY } from "./deterministic";
export function DeployPage() {
  const { networks } = useSession();
  if (!networks.length)
    return (
      <p>
        Enable a network in Networks to deploy contracts.{" "}
        <a href="#/networks">Networks</a>
      </p>
    );
  return (
    <section>
      <h2>Deploy contracts</h2>
      <p>
        Deploy missing contracts once for everyone on this network. Addresses
        depend on the fixed salt and contract code, never on your wallet.
        Existing contracts are detected before any deployment.
      </p>
      <NetworkSettingSelect />
      <DeploymentCard kind="Core" />
      <DeploymentCard kind="PoolKeyIndex" />
      <DeploymentCard kind="FreeLP" />
      <DeploymentCard kind="FreeLPDataFetcher" />
      <details>
        <summary>Deterministic deployment details</summary>
        <p>
          CREATE2 factory: <code>{CREATE2_FACTORY}</code>
        </p>
        <p>
          Fixed salt: <code>{DEPLOYMENT_SALT}</code>
        </p>
        <p>
          This build uses fixed contract addresses on every network. Networks
          must provide the standard CREATE2 factory.
        </p>
      </details>
    </section>
  );
}
