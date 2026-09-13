import { errorMessage } from "./errors";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { verifyCode, type ContractKind } from "./contracts";
import {
  deploymentAddress,
  deploymentStatus,
  prepareDeployment,
} from "./deterministic";
import { Action, ErrorText } from "./common";
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";

export function DeploymentCard({ kind }: { kind: ContractKind }) {
  const { settings, send, revision, setStatus } = useSession();
  const [checked, setChecked] = useState<{
    scope: string;
    exists?: boolean;
    error?: string;
  }>();
  const [refresh, setRefresh] = useState(0);
  const scope = JSON.stringify([settings, kind, revision, refresh]);
  const address = deploymentAddress(kind, settings.core);
  const current = checked?.scope === scope ? checked : undefined;
  const usesCore = kind !== "Core";
  useEffect(() => {
    let active = true;
    deploymentStatus(settings, kind)
      .then(({ exists }) => {
        if (active) setChecked({ scope, exists });
      })
      .catch((e) => {
        if (active) setChecked({ scope, error: errorMessage(e) });
      });
    return () => {
      active = false;
    };
  }, [settings, kind, scope]);
  async function deploy() {
    const transaction = await prepareDeployment(settings, kind);
    await send(transaction);
    await verifyCode(settings, address, kind);
    setStatus(`Deployed ${kind} at ${address}.`);
    setRefresh((n) => n + 1);
  }
  return (
    <article className="panel">
      <h3>{kind === "FreeLP" ? "Position manager" : kind}</h3>
      <p className="mono">{address}</p>
      {usesCore ? (
        <p>
          Core: <code>{settings.core}</code>
        </p>
      ) : null}
      {kind === "FreeLP" ? (
        <p>
          PoolKeyIndex: <code>{DEFAULT_POOL_KEY_INDEX}</code>
        </p>
      ) : null}
      <p role="status">
        <DeploymentMessage current={current} />
      </p>
      <ErrorText error={current?.error ?? ""} />
      {!current?.exists ? (
        <div className="row">
          <Action run={deploy} disabled={deploymentDisabled(current)}>
            Deploy {kind}
          </Action>
          <button onClick={() => setRefresh((n) => n + 1)}>
            Refresh status
          </button>
        </div>
      ) : null}
    </article>
  );
}

type Check = { exists?: boolean; error?: string } | undefined;
function deploymentDisabled(current: Check) {
  return !current || !!current.error || current.exists;
}
function DeploymentMessage({ current }: { current: Check }) {
  if (!current) return "Checking code on this network…";
  if (current.exists)
    return "Already deployed · code verified against this build";
  if (current.error)
    return "Contract verification failed. Deployment is disabled.";
  return "Not deployed · no code at this address";
}
