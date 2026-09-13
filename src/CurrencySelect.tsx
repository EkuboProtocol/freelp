import { readTokenMetadata } from "./readTokenMetadata";
import { errorMessage } from "./errors";
import { TokenPickerRows, PickerBalanceStatus } from "./TokenPickerRows";
import { tokenPickerKeyboard } from "./tokenPickerKeyboard";
import { useTokenBalances } from "./useTokenBalances";
import { networkName } from "./networks";
import type { Settings } from "./types";
import { useId, useRef, useState } from "react";
import { isAddress } from "viem";
import { networkCurrencies, importCurrency, type Currency } from "./tokens";
import { useSession } from "./session";
import { ErrorText } from "./common";

export function CurrencySelect({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (token: Currency, chainId: number) => void;
}) {
  const titleId = useId();
  const { settings, account } = useSession();
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const [search, setSearch] = useState("");
  const tokens = networkCurrencies(settings);
  const [importNetwork, setImportNetwork] = useState(settings);
  const [candidate, setCandidate] = useState<Currency>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = tokens.find(
    (token) => token.address.toLowerCase() === value.toLowerCase(),
  );
  const choices = [settings];
  const balances = useTokenBalances(choices, open, refresh);
  const visible = choices
    .flatMap((network) =>
      networkCurrencies(network).map((token) => ({
        token,
        network,
      })),
    )
    .filter(({ token, network }) =>
      `${token.symbol} ${token.name} ${token.address} ${networkName(network.chainId, network.name)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  function choose(token: Currency, chainId = settings.chainId) {
    onChange(token, chainId);
    dialog.current?.close();
    setOpen(false);
  }
  async function inspect(network: Settings) {
    const id = ++request.current;
    setBusy(true);
    setCandidate(undefined);
    setImportNetwork(network);
    setError("");
    try {
      const token = await readTokenMetadata(network, search);
      if (id === request.current) setCandidate(token);
    } catch (error) {
      if (id === request.current) setError(errorMessage(error));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="currency-select"
        aria-label={label}
        onClick={() => {
          request.current++;
          setBusy(false);
          setSearch("");
          setCandidate(undefined);
          setError("");
          setOpen(true);
          dialog.current?.showModal();
          searchInput.current?.focus();
        }}
      >
        <span>
          {selected?.symbol ?? <UnlistedToken value={value} />}{" "}
          <small>{selectedNetworkLabel(selected, settings)}</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      <dialog
        ref={dialog}
        className="currency-dialog"
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onKeyDown={tokenPickerKeyboard}
      >
        <div className="row spread">
          <h2 id={titleId}>Select a token</h2>
          <button
            aria-label={"Close token selector"}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="token-search-row">
          <input
            aria-label={"Search tokens or paste an address"}
            placeholder={"Search tokens or paste an address"}
            ref={searchInput}
            name="token-search"
            spellCheck={false}
            autoComplete="off"
            value={search}
            onChange={(event) => {
              request.current++;
              setBusy(false);
              setSearch(event.target.value);
              setCandidate(undefined);
              setError("");
            }}
          />
          {account ? (
            <button
              type="button"
              aria-label={"Refresh balances"}
              onClick={() => setRefresh((n) => n + 1)}
            >
              Refresh
            </button>
          ) : null}
        </div>
        <PickerStatus
          busy={busy}
          error={error}
          addressSearch={isAddress(search)}
          hasCandidate={!!candidate}
          count={visible.length}
        />
        <PickerBalanceStatus connected={!!account} balances={balances} />
        <div className="token-list">
          <TokenPickerRows
            entries={visible}
            balances={balances}
            connected={!!account}
            choose={choose}
          />
        </div>
        {isAddress(search) ? (
          <div className="row">
            {choices.map((network) => (
              <button
                key={network.chainId}
                disabled={busy}
                onClick={() => void inspect(network)}
              >
                Read token on {networkName(network.chainId, network.name)}
              </button>
            ))}
          </div>
        ) : null}
        {candidate ? (
          <div className="panel">
            <strong>{candidate.symbol}</strong>
            <p>
              {candidate.name} · {candidate.decimals} decimals
            </p>
            <p className="mono">{candidate.address}</p>
            <p className="metadata-note">
              Name, symbol, and decimals were read from this token contract.
              Review them before importing; decimals are never inferred.
            </p>
            <button
              onClick={() => {
                const imported = importCurrency(
                  importNetwork.chainId,
                  candidate,
                );
                choose(imported, importNetwork.chainId);
              }}
            >
              Import token
            </button>
          </div>
        ) : null}
        <ErrorText error={error} />
      </dialog>
    </>
  );
}

function PickerStatus({
  busy,
  error,
  addressSearch,
  hasCandidate,
  count,
}: {
  busy: boolean;
  error: string;
  addressSearch: boolean;
  hasCandidate: boolean;
  count: number;
}) {
  let message = "No matching tokens.";
  if (busy) message = "Reading token metadata from the selected network…";
  else if (error) message = "Token metadata could not be read.";
  else if (addressSearch && !hasCandidate)
    message = "Paste an address and choose a network to read its metadata.";
  else if (count) message = `${count} token${count === 1 ? "" : "s"} found.`;
  return (
    <p className="picker-status" role="status" aria-live="polite">
      {message}
    </p>
  );
}

function selectedNetworkLabel(
  selected: Currency | undefined,
  settings: Settings,
) {
  return selected ? networkName(settings.chainId, settings.name) : "";
}

function UnlistedToken({ value }: { value: string }) {
  return isAddress(value) ? (
    <span title={value}>
      {value.slice(0, 6)}…{value.slice(-4)}
    </span>
  ) : (
    "Select token"
  );
}
