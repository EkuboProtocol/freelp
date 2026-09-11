import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { zeroAddress } from "viem";
import { useSession } from "./session";
import { verifyCode, type ContractKind } from "./contracts";
import {
  deploymentAddress,
  deploymentStatus,
  prepareDeployment,
} from "./deterministic";
import { Action, ErrorText } from "./common";
import type { Settings } from "./types";

const FIELDS = {
  Core: "core",
  FreeLP: "manager",
  QuoteDataFetcher: "quoteDataFetcher",
  CoreDataFetcher: "coreDataFetcher",
  TokenDataFetcher: "tokenDataFetcher",
  FreeLPDataFetcher: "freeLPDataFetcher",
} as const;
function configured(settings: Settings, kind: ContractKind) {
  const address = deploymentAddress(kind, settings.core);
  if (kind !== "Core") return { ...settings, [FIELDS[kind]]: address };
  return {
    ...settings,
    core: address,
    manager: deploymentAddress("FreeLP", address),
    quoteDataFetcher: deploymentAddress("QuoteDataFetcher", address),
    coreDataFetcher: deploymentAddress("CoreDataFetcher", address),
    tokenDataFetcher: deploymentAddress("TokenDataFetcher", address),
    freeLPDataFetcher: deploymentAddress("FreeLPDataFetcher", address),
  };
}
export function DeploymentCard({ kind }: { kind: ContractKind }) {
  const { settings, configure, send, revision, setStatus } = useSession();
  const [checked, setChecked] = useState<{
    scope: string;
    exists?: boolean;
    error?: string;
  }>();
  const [refresh, setRefresh] = useState(0);
  const scope = JSON.stringify([settings, kind, revision, refresh]);
  const address = deploymentAddress(kind, settings.core);
  const current = checked?.scope === scope ? checked : undefined;
  const usesCore =
    !["Core", "TokenDataFetcher", "FreeLPDataFetcher"].includes(kind);
  useEffect(() => {
    let active = true;
    deploymentStatus(settings, kind)
      .then(({ exists }) => {
        if (active) setChecked({ scope, exists });
      })
      .catch((e) => {
        if (active) setChecked({ scope, error: String(e) });
      });
    return () => {
      active = false;
    };
  }, [settings, kind, scope]);
  async function activateExisting() {
    await verifyCode(settings, address, kind);
    configure(configured(settings, kind));
    setStatus(t`Using ${kind} at ${address}.`);
  }
  async function deploy() {
    const transaction = await prepareDeployment(settings, kind);
    await send(transaction);
    await activateExisting();
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
        <Action
          run={deploy}
          disabled={deploymentDisabled(current, usesCore, settings)}
        >
          <Trans>Deploy {kind}</Trans>
        </Action>
        {current?.exists ? (
          <button
            onClick={() =>
              void activateExisting().catch((e) => setStatus(String(e)))
            }
          >
            <Trans>Use existing deployment</Trans>
          </button>
        ) : null}
        <button onClick={() => setRefresh((n) => n + 1)}>
          <Trans>Refresh status</Trans>
        </button>
      </div>
    </article>
  );
}

type Check = { exists?: boolean; error?: string } | undefined;
function deploymentDisabled(
  current: Check,
  usesCore: boolean,
  settings: Settings,
) {
  return (
    !current ||
    !!current.error ||
    current.exists ||
    (usesCore && settings.core === zeroAddress)
  );
}
function DeploymentMessage({ current }: { current: Check }) {
  if (!current) return <Trans>Checking code on this network…</Trans>;
  if (current.exists) return <Trans>Already deployed · code verified</Trans>;
  if (current.error)
    return (
      <Trans>Unable to verify this address. Deployment is disabled.</Trans>
    );
  return <Trans>Not deployed · no code at this address</Trans>;
}
