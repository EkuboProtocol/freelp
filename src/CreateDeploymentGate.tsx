import { useEffect, useState, type ReactNode } from "react";
import { useSession, rpc } from "./session";
import { verifyCode } from "./contracts";
import { ContractIdentityError } from "./contractIdentity";
import {
  DEFAULT_POSITION_DATA_FETCHER,
  DEFAULT_POOL_KEY_INDEX,
} from "./deployments";
import { errorMessage } from "./errors";
import type { Settings } from "./types";
type DeploymentIssue = { message: string; missing: boolean };
export async function checkCreateDeployment(settings: Settings) {
  if ((await rpc(settings).getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match this network.");
  const required = [
    ["Core", settings.core],
    ["PoolKeyIndex", DEFAULT_POOL_KEY_INDEX],
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
        return {
          message: `${kind}: ${errorMessage(error)}`,
          missing:
            error instanceof ContractIdentityError && error.state === "missing",
        };
      }
    }),
  );
  return results.filter((error): error is DeploymentIssue => !!error);
}
export function CreateDeploymentGate({ children }: { children: ReactNode }) {
  const { settings, revision, selectNetwork } = useSession();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    errors: DeploymentIssue[];
  }>();
  const key = JSON.stringify([settings, revision, refresh]);
  useEffect(() => {
    let active = true;
    void checkCreateDeployment(settings)
      .catch((error) => [{ message: errorMessage(error), missing: false }])
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
  const missing = current.errors.every((error) => error.missing);
  return (
    <div className="panel" role="alert">
      <h3>
        {missing
          ? "Deploy contracts to create positions"
          : "Unable to verify this network"}
      </h3>
      <p>
        Core, PoolKeyIndex, FreeLPDataFetcher, and the position manager must
        match this build before you can create a position on this network.
      </p>
      <ul>
        {current.errors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
      <div className="row">
        {missing ? (
          <a
            className="primary-link"
            href="#/deploy"
            onClick={() => selectNetwork(settings.chainId)}
          >
            Go to Deploy
          </a>
        ) : (
          <a href="#/networks">Review network RPC</a>
        )}
        <button onClick={() => setRefresh((n) => n + 1)}>Check again</button>
      </div>
    </div>
  );
}
