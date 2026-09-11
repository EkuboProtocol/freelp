import { useEffect, useState, type ReactNode } from "react";
import { useSession, rpc } from "./session";
import { verifyCode } from "./contracts";
import { DEFAULT_POSITION_DATA_FETCHER } from "./deployments";
import { errorMessage } from "./errors";
import type { Settings } from "./types";
export async function checkCreateDeployment(settings: Settings) {
  if ((await rpc(settings).getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match this network.");
  const required = [
    ["Core", settings.core],
    ["FreeLP", settings.manager],
    [
      "FreeLPDataFetcher",
      settings.freeLPDataFetcher ?? DEFAULT_POSITION_DATA_FETCHER,
    ],
  ] as const;
  const results = await Promise.all(
    required.map(async ([kind, address]) => {
      try {
        await verifyCode(settings, address, kind);
        return undefined;
      } catch (error) {
        return `${kind}: ${errorMessage(error)}`;
      }
    }),
  );
  return results.filter((error): error is string => !!error);
}
export function CreateDeploymentGate({ children }: { children: ReactNode }) {
  const { settings, revision, selectNetwork } = useSession();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; errors: string[] }>();
  const key = JSON.stringify([settings, revision, refresh]);
  useEffect(() => {
    let active = true;
    void checkCreateDeployment(settings)
      .catch((error) => [errorMessage(error)])
      .then((errors) => {
        if (active) setResult({ key, errors });
      });
    return () => {
      active = false;
    };
  }, [settings, key]);
  const current = result?.key === key ? result : undefined;
  if (!current) return <p role="status">Checking required contracts…</p>;
  if (!current.errors.length) return children;
  return (
    <div className="panel" role="alert">
      <h3>Deploy contracts to create positions</h3>
      <p>
        Core, FreeLPDataFetcher, and the position manager must match this build
        before you can create a position on this network.
      </p>
      <ul>
        {current.errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      <div className="row">
        <a
          className="primary-link"
          href="#/deploy"
          onClick={() => selectNetwork(settings.chainId)}
        >
          Go to Deploy
        </a>
        <button onClick={() => setRefresh((n) => n + 1)}>Check again</button>
      </div>
    </div>
  );
}
