import { errorMessage } from "./errors";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useSession } from "./session";
import { verifyCode, type ContractKind } from "./contracts";
import {
  deploymentAddress,
  deploymentStatus,
  prepareDeployment,
} from "./deterministic";
import { Action, ErrorText } from "./common";

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
    setStatus(t`Deployed ${kind} at ${address}.`);
    setRefresh((n) => n + 1);
  }
  return (
    <article className="panel">
      <h3>{kind === "FreeLP" ? <Trans>Position manager</Trans> : kind}</h3>
      <p className="mono">{address}</p>
      {usesCore ? (
        <p>
          <Trans>Core:</Trans> <code>{settings.core}</code>
        </p>
      ) : null}
      <p role="status">
        <DeploymentMessage current={current} />
      </p>
      <ErrorText error={current?.error ?? ""} />
      <div className="row">
        <Action run={deploy} disabled={deploymentDisabled(current)}>
          <Trans>Deploy {kind}</Trans>
        </Action>
        <button onClick={() => setRefresh((n) => n + 1)}>
          <Trans>Refresh status</Trans>
        </button>
      </div>
    </article>
  );
}

type Check = { exists?: boolean; error?: string } | undefined;
function deploymentDisabled(current: Check) {
  return !current || !!current.error || current.exists;
}
function DeploymentMessage({ current }: { current: Check }) {
  if (!current) return <Trans>Checking code on this network…</Trans>;
  if (current.exists) return <Trans>Already deployed</Trans>;
  if (current.error)
    return <Trans>Unable to read this address. Deployment is disabled.</Trans>;
  return <Trans>Not deployed · no code at this address</Trans>;
}
