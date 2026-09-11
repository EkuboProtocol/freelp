import { Trans } from "@lingui/react/macro";
import { useSession } from "./session";
import { networkName } from "./networks";
export function NetworkSettingSelect() {
  const { settings, networks, selectNetwork, busy } = useSession();
  return (
    <label>
      <Trans>Deployment network</Trans>
      <select
        disabled={busy}
        value={settings.chainId}
        onChange={(e) => selectNetwork(Number(e.target.value))}
      >
        {networks.map((n) => (
          <option key={n.chainId} value={n.chainId}>
            {networkName(n.chainId, n.name)}
          </option>
        ))}
      </select>
    </label>
  );
}
