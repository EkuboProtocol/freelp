import { useEffect, useMemo, useState } from "react";
import { NetworkScope, useSession } from "./session";
import { DeploymentCard } from "./DeploymentCard";
import { DeployAllButton } from "./DeployAllButton";
import { DEPLOYMENT_SALT, CREATE2_FACTORY } from "./deterministic";
import { configuredNetwork, networkName } from "./networks";
import { deployPath } from "./routes";
import {
  verifyNetworkDeployment,
  type NetworkCheck,
} from "./networkVerification";
import type { Settings } from "./types";

export function DeployRedirect() {
  const { settings, networks } = useSession();
  useEffect(() => {
    if (networks.length) location.replace(deployPath(settings.chainId));
  }, [networks.length, settings.chainId]);
  if (!networks.length)
    return (
      <p>
        Choose a network in Networks to deploy contracts.{" "}
        <a href="#/networks">Networks</a>
      </p>
    );
  return <p role="status">Opening the active network…</p>;
}

export function InvalidDeployLink() {
  return (
    <section>
      <h2>Deploy contracts</h2>
      <p role="alert">
        This deployment link does not name a supported network. Open Deploy
        contracts from a network in Networks.
      </p>
      <a className="primary-link" href="#/networks">
        Networks
      </a>
    </section>
  );
}

export function DeployPage({ chainId }: { chainId: number }) {
  const { networks } = useSession();
  // RPC overrides change only in Networks, which replaces this page.
  const settings = useMemo(() => configuredNetwork(chainId), [chainId]);
  const enabled = networks.some((network) => network.chainId === chainId);
  return (
    <NetworkScope settings={settings}>
      <section>
        <h2>Deploy contracts</h2>
        <p>
          Network: <strong>{networkName(chainId, settings.name)}</strong> (
          {chainId}) · {enabled ? "enabled" : "not enabled"}
        </p>
        <p>
          Deploy missing contracts once for everyone on this network. Addresses
          depend on the fixed salt and contract code, never on your wallet.
          Existing contracts are detected before any deployment.
        </p>
        <DeployAllButton />
        <DeploymentCard kind="Core" />
        <DeploymentCard kind="PoolKeyIndex" />
        <DeploymentCard kind="FreeLPMetadataRenderer" />
        <DeploymentCard kind="FreeLP" />
        <DeploymentCard kind="FreeLPDataFetcher" />
        <DeployNextStep settings={settings} enabled={enabled} />
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
    </NetworkScope>
  );
}

/** Deployment never enables a network; the user enables it in Networks. */
function DeployNextStep({
  settings,
  enabled,
}: {
  settings: Settings;
  enabled: boolean;
}) {
  const { revision } = useSession();
  const scope = JSON.stringify([settings, revision]);
  const [result, setResult] = useState<{
    scope: string;
    check: NetworkCheck;
  }>();
  useEffect(() => {
    let active = true;
    void verifyNetworkDeployment(settings).then((check) => {
      if (active) setResult({ scope, check });
    });
    return () => {
      active = false;
    };
  }, [settings, scope]);
  const check = result?.scope === scope ? result.check : undefined;
  if (check?.state !== "ready") return null;
  return (
    <p className="panel" role="status">
      {enabled
        ? "All contracts are deployed and this network is enabled."
        : "All contracts are deployed. Now enable this network in Networks."}{" "}
      <a href="#/networks">Networks</a>
    </p>
  );
}
