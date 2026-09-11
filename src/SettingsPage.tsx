import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { MAINNET_CHAINS, chainDefinition, rpcEndpoint } from "./chains";
import { configuredNetwork } from "./networks";
import { validateSettings } from "./config";
import { rpc, useSession } from "./session";
import { errorMessage } from "./errors";
import type { Settings } from "./types";
export function SettingsPage() {
  const {
    networks,
    configure,
    toggleNetwork,
    busy: transactionBusy,
  } = useSession();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(40);
  const [editing, setEditing] = useState<Settings>();
  const [rpcUrl, setRpcUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const enabled = new Set(networks.map((network) => network.chainId));
  const choices = availableChoices(showAll, search, networks);
  const matches = choices.filter((chain) =>
    `${chain.name} ${chain.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  function open(id: number) {
    const network = configuredNetwork(id);
    setEditing(network);
    setRpcUrl(network.rpcUrl);
    setError("");
    dialog.current?.showModal();
    input.current?.focus();
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
            t`Expected chain ${next.chainId}, but this RPC reports ${id}.`,
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
  return (
    <section>
      <h2>
        <Trans>Networks</Trans>
      </h2>
      <p>
        <Trans>
          Enable the networks you use. Their names, native tokens and default
          RPCs come from viem.
        </Trans>
      </p>
      <input
        aria-label={t`Search networks`}
        placeholder={t`Search networks`}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setLimit(40);
        }}
      />
      <div className="network-list">
        {matches.slice(0, limit).map((chain) => (
          <div className="network-row" key={chain.id}>
            <label className="row">
              <input
                type="checkbox"
                aria-label={t`Enable ${chain.name}`}
                checked={enabled.has(chain.id)}
                disabled={transactionBusy}
                onChange={(event) =>
                  toggleNetwork(chain.id, event.target.checked)
                }
              />
              <span>
                <strong>{chain.name}</strong>
                <small>
                  {chain.id} · {chain.nativeCurrency.symbol}
                </small>
              </span>
            </label>
            <button
              aria-label={t`Edit ${chain.name} RPC`}
              disabled={transactionBusy}
              onClick={() => open(chain.id)}
            >
              <Trans>RPC settings</Trans>
            </button>
          </div>
        ))}
      </div>
      {!matches.length ? (
        <p>
          <Trans>No matching networks.</Trans>
        </p>
      ) : null}
      {!search ? (
        <button
          onClick={() => {
            setShowAll(!showAll);
            setLimit(40);
          }}
        >
          {showAll ? (
            <Trans>Show enabled networks</Trans>
          ) : (
            <Trans>Show all networks</Trans>
          )}
        </button>
      ) : null}
      {matches.length > limit ? (
        <button onClick={() => setLimit((value) => value + 40)}>
          <Trans>Show more</Trans>
        </button>
      ) : null}
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
              <Trans>RPC settings</Trans>
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
          <p>{editing?.name}</p>
          <label>
            <Trans>RPC URL override</Trans>
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
          <p>
            <Trans>Leave blank to use this network's default RPC.</Trans>
          </p>
          <button type="button" disabled={busy} onClick={() => setRpcUrl("")}>
            <Trans>Use default RPC</Trans>
          </button>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? <Trans>Checking RPC…</Trans> : <Trans>Save RPC</Trans>}
          </button>
        </form>
      </dialog>
    </section>
  );
}

function availableChoices(
  showAll: boolean,
  search: string,
  networks: Settings[],
) {
  return showAll || search
    ? MAINNET_CHAINS
    : networks.map((network) => chainDefinition(network.chainId));
}
