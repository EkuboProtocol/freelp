import { useEffect, useRef, useState } from "react";
import { DEFAULT_CHAIN_IDS, MAINNET_CHAINS, rpcEndpoint } from "./chains";
import { configuredNetwork } from "./networks";
import { validateSettings } from "./config";
import { rpc, useSession } from "./session";
import { errorMessage } from "./errors";
import type { Settings } from "./types";
import { storageWarning, subscribeStorageWarnings } from "./storage";
import {
  EnableBlockedDialog,
  ROW_LABELS,
  useEnableGate,
} from "./NetworkEnableGate";
export function SettingsPage() {
  const {
    networks,
    configure,
    toggleNetwork,
    busy: transactionBusy,
  } = useSession();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Settings>();
  const [rpcUrl, setRpcUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState(storageWarning);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const gate = useEnableGate((id) => toggleNetwork(id, true));
  const enabled = new Set(networks.map((network) => network.chainId));
  const matches = MAINNET_CHAINS.filter((chain) =>
    `${chain.name} ${chain.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  useEffect(() => subscribeStorageWarnings(setStorageMessage), []);
  function open(id: number) {
    const network = configuredNetwork(id);
    setEditing(network);
    setRpcUrl(network.rpcUrl);
    setError("");
    dialog.current?.showModal();
    input.current?.focus();
  }
  function useDefaultRpc() {
    if (!editing) return;
    try {
      configure({ ...editing, rpcUrl: "" });
      setRpcUrl("");
      setError("");
      dialog.current?.close();
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const next = validateSettings({ ...editing, rpcUrl });
      if (next.rpcUrl) {
        const id = await rpc(next).getChainId();
        if (id !== next.chainId)
          throw new Error(
            `Expected chain ${next.chainId}, but this RPC reports ${id}.`,
          );
      }
      configure(next);
      dialog.current?.close();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  function restoreDefaults() {
    for (const id of DEFAULT_CHAIN_IDS) {
      if (!enabled.has(id)) toggleNetwork(id, true);
    }
  }
  return (
    <section className="networks-page">
      <h2>Networks</h2>
      <p>
        The catalog lists supported viem mainnets. Enable only the networks you
        use. Enabling a network checks that its RPC answers and that this
        build's contracts are deployed there; listing makes no RPC requests.
      </p>
      <p>
        Catalog: {MAINNET_CHAINS.length} mainnets · Enabled: {networks.length} ·
        RPC: configured per enabled network
      </p>
      {storageMessage ? <p role="status">{storageMessage}</p> : null}
      {!networks.length ? (
        <button
          type="button"
          disabled={transactionBusy}
          onClick={restoreDefaults}
        >
          Restore default networks
        </button>
      ) : null}
      <input
        className="network-search"
        aria-label={"Search networks"}
        placeholder={"Search networks"}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />
      <div className="network-list">
        {matches.map((chain) => (
          <div className="network-row" key={chain.id}>
            <label className="row">
              <input
                type="checkbox"
                aria-label={`Enable ${chain.name}`}
                aria-busy={gate.checking === chain.id}
                checked={enabled.has(chain.id)}
                disabled={transactionBusy || gate.checking !== undefined}
                onChange={(event) =>
                  event.target.checked
                    ? void gate.enable(chain.id)
                    : toggleNetwork(chain.id, false)
                }
              />
              <span>
                <strong>{chain.name}</strong>
                <small>
                  {chain.id} · {chain.nativeCurrency.symbol} · catalog
                  {enabled.has(chain.id) ? " · enabled" : " · disabled"} · RPC{" "}
                  {configuredNetwork(chain.id).rpcUrl ? "custom" : "default"} ·{" "}
                  {gate.checking === chain.id
                    ? "Checking…"
                    : ROW_LABELS[gate.rowState(chain.id)]}
                </small>
              </span>
            </label>
            <button
              aria-label={`Edit ${chain.name} RPC`}
              disabled={transactionBusy}
              onClick={() => open(chain.id)}
            >
              RPC settings
            </button>
          </div>
        ))}
      </div>
      {!matches.length ? <p>No matching networks.</p> : null}
      <EnableBlockedDialog blocked={gate.blocked} onCancel={gate.dismiss} />
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
            <h2 id="network-dialog-title">RPC settings</h2>
            <button
              type="button"
              aria-label={"Close network dialog"}
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </div>
          <p>{editing?.name}</p>
          <label>
            RPC URL override
            <input
              ref={input}
              type="url"
              value={rpcUrl}
              placeholder={
                editing ? rpcEndpoint({ ...editing, rpcUrl: "" }) : "https://"
              }
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setRpcUrl(event.target.value)}
            />
          </label>
          <p>Leave blank to use this network's default RPC.</p>
          {error ? <p role="alert">{error}</p> : null}
          <div className="rpc-dialog-actions">
            <button type="button" disabled={busy} onClick={useDefaultRpc}>
              Use default RPC
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Checking RPC…" : "Save RPC"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
