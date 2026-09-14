import { useEffect, useState } from "react";
import { useSession } from "./session";
import { useBatchSupport } from "./useBatchSupport";
import { prepareAllDeployments } from "./deterministic";
import { Action, ErrorText } from "./common";
import { errorMessage } from "./errors";

export function DeployAllButton() {
  const { settings, revision, send, setStatus } = useSession();
  const supported = useBatchSupport();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    scope: string;
    count?: number;
    error?: string;
  }>();
  const scope = JSON.stringify([settings, revision, refresh, supported]);
  useEffect(() => {
    let active = true;
    if (supported === true) {
      void prepareAllDeployments(settings)
        .then((calls) => {
          if (active) setResult({ scope, count: calls.length });
        })
        .catch((error) => {
          if (active) setResult({ scope, error: errorMessage(error) });
        });
    }
    return () => {
      active = false;
    };
  }, [settings, scope, supported]);
  if (supported !== true) return null;
  const current = result?.scope === scope ? result : undefined;
  async function deployAll() {
    const calls = await prepareAllDeployments(settings);
    if (!calls.length) {
      setRefresh((value) => value + 1);
      return;
    }
    await send(calls);
    if ((await prepareAllDeployments(settings)).length)
      throw new Error(
        "Some contracts are still missing. Refresh deployments to see the current state.",
      );
    setStatus("Deployed all required contracts.");
    setRefresh((value) => value + 1);
  }
  return (
    <div className="deploy-all">
      <div className="row">
        <Action run={deployAll} disabled={!current?.count}>
          Deploy all
        </Action>
        <span>
          {current?.count === 0
            ? "All contracts are deployed."
            : "Deploy missing contracts in one wallet request."}
        </span>
        <button type="button" onClick={() => setRefresh((value) => value + 1)}>
          Refresh deployments
        </button>
      </div>
      <ErrorText error={current?.error ?? ""} />
    </div>
  );
}
