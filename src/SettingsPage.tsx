import {
  NetworkDetailsFields,
  EMPTY_NETWORK_DETAILS,
  type NetworkDetailsInput,
} from "./NetworkDetailsFields";
import { nativeCurrency } from "./nativeCurrency";
import { t } from "@lingui/core/macro";
import { useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { createPublicClient, http } from "viem";
import { useSession } from "./session";
import { DEFAULT_CONTRACTS } from "./deployments";
import { NETWORKS, networkName } from "./networks";
import { errorMessage } from "./errors";
import type { Settings } from "./types";

export function SettingsPage() {
  const { networks, configure } = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Settings>();
  const [details, setDetails] = useState(EMPTY_NETWORK_DETAILS);
  const [rpcUrl, setRpcUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function open(network?: Settings) {
    setEditing(network);
    setDetails(
      network
        ? {
            name: network.name ?? "",
            nativeSymbol: network.nativeSymbol,
            nativeName: nativeCurrency(network).name,
            nativeDecimals: String(nativeCurrency(network).decimals),
          }
        : EMPTY_NETWORK_DETAILS,
    );
    setRpcUrl(network?.rpcUrl ?? "");
    setError("");
    dialog.current?.showModal();
    input.current?.focus();
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      configure(
        applyNetworkDetails(
          await detectNetwork(rpcUrl, networks, editing),
          details,
        ),
      );
      dialog.current?.close();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="row spread">
        <h2>
          <Trans>Networks</Trans>
        </h2>
        <button onClick={() => open()}>
          <Trans>Add network</Trans>
        </button>
      </div>
      <p>
        <Trans>
          Use public RPC URLs or your own nodes. Settings stay in this browser.
        </Trans>
      </p>
      <div className="network-list">
        {networks.map((network) => (
          <div className="network-row" key={network.chainId}>
            <div>
              <strong>{networkName(network.chainId, network.name)}</strong>
              <span className="network-rpc">{network.rpcUrl}</span>
            </div>
            <button
              aria-label={t`Edit ${networkName(network.chainId, network.name)} RPC`}
              onClick={() => open(network)}
            >
              <Trans>Edit</Trans>
            </button>
          </div>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="network-dialog"
        aria-labelledby="network-dialog-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="row spread">
            <h2 id="network-dialog-title">
              {editing ? <Trans>Edit RPC</Trans> : <Trans>Add network</Trans>}
            </h2>
            <button
              type="button"
              aria-label={t`Close network dialog`}
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </div>
          <label>
            <span className="sr-only">
              <Trans>RPC URL</Trans>
            </span>
            <input
              ref={input}
              type="url"
              value={rpcUrl}
              placeholder="https://"
              required
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setRpcUrl(event.target.value)}
            />
          </label>
          <p className="network-hint">
            <Trans>The network is detected from your RPC URL.</Trans>
          </p>
          <NetworkDetailsFields
            value={details}
            onChange={setDetails}
            disabled={busy}
          />
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy}>
            {busy ? <Trans>Connecting…</Trans> : <Trans>Save network</Trans>}
          </button>
        </form>
      </dialog>
    </section>
  );
}

async function detectNetwork(
  rpcUrl: string,
  networks: Settings[],
  editing?: Settings,
): Promise<Settings> {
  const url = new URL(rpcUrl.trim());
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error(t`RPC must use HTTP or HTTPS.`);
  const client = createPublicClient({
    ccipRead: false,
    transport: http(url.href, { retryCount: 0, timeout: 15000 }),
  });
  const chainId = await client.getChainId();
  if (!Number.isSafeInteger(chainId) || chainId < 1)
    throw new Error(t`The RPC returned an invalid chain ID.`);
  if (editing && chainId !== editing.chainId)
    throw new Error(
      t`Expected chain ${editing.chainId}, but this RPC reports ${chainId}.`,
    );
  const known =
    networks.find((n) => n.chainId === chainId) ??
    NETWORKS.find((n) => n.chainId === chainId);
  return {
    ...DEFAULT_CONTRACTS,
    chainId,
    rpcUrl: url.href,
    ...networkDetails(chainId, known),
  };
}

function networkDetails(
  chainId: number,
  known?: Pick<
    Settings,
    "name" | "nativeSymbol" | "nativeName" | "nativeDecimals"
  >,
) {
  return {
    name: known?.name ?? t`Chain ${chainId}`,
    nativeSymbol: known?.nativeSymbol ?? "native",
    nativeName: known?.nativeName,
    nativeDecimals: known?.nativeDecimals,
  };
}

function applyNetworkDetails(
  network: Settings,
  details: NetworkDetailsInput,
): Settings {
  return {
    ...network,
    name: details.name.trim() || network.name,
    nativeSymbol: details.nativeSymbol.trim() || network.nativeSymbol,
    nativeName: details.nativeName.trim() || network.nativeName,
    nativeDecimals:
      details.nativeDecimals === ""
        ? network.nativeDecimals
        : Number(details.nativeDecimals),
  };
}
