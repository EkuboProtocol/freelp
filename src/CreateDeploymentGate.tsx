import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "./session";
import { deployPath } from "./routes";
import {
  verifyNetworkDeployment,
  type NetworkCheck,
} from "./networkVerification";
export function CreateDeploymentGate({ children }: { children: ReactNode }) {
  const { settings, revision } = useSession();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; check: NetworkCheck }>();
  const key = JSON.stringify([settings, revision, refresh]);
  useEffect(() => {
    let active = true;
    void verifyNetworkDeployment(settings).then((check) => {
      if (active) setResult({ key, check });
    });
    return () => {
      active = false;
    };
  }, [settings, key]);
  const current = result?.key === key ? result.check : undefined;
  if (!current) return <p role="status">Checking required contracts…</p>;
  if (current.state === "ready") return children;
  const missing = current.state === "missing";
  return (
    <div className="panel" role="alert">
      <h3>
        {missing
          ? "Deploy contracts to create positions"
          : "Unable to verify this network"}
      </h3>
      <p>
        Core, PoolKeyIndex, the metadata renderer, FreeLPDataFetcher, and the
        position manager must match this build before you can create a position
        on this network.
      </p>
      <ul>
        {current.issues.map((issue) => (
          <li key={issue.kind}>{issue.message}</li>
        ))}
      </ul>
      <div className="row">
        {missing ? (
          <a className="primary-link" href={deployPath(settings.chainId)}>
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
