import { readTokenMetadata } from "./readTokenMetadata";
import { errorMessage } from "./errors";
import { TokenPickerRows, PickerBalanceStatus } from "./TokenPickerRows";
import { tokenPickerKeyboard } from "./tokenPickerKeyboard";
import { useTokenBalances } from "./useTokenBalances";
import { networkName } from "./networks";
import type { Settings } from "./types";
import { useId, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
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
        onClose={() => setOpen(false)}
        onKeyDown={tokenPickerKeyboard}
      >
        <div className="row spread">
          <h2 id={titleId}>
            <Trans>Select a token</Trans>
          </h2>
          <button
            aria-label={t`Close token selector`}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="token-search-row">
          <input
            aria-label={t`Search tokens or paste an address`}
            placeholder={t`Search tokens or paste an address`}
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
            }}
          />
          {account ? (
            <button
              type="button"
              aria-label={t`Refresh balances`}
              onClick={() => setRefresh((n) => n + 1)}
            >
              <Trans>Refresh</Trans>
            </button>
          ) : null}
        </div>
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
                <Trans>
                  Read token on {networkName(network.chainId, network.name)}
                </Trans>
              </button>
            ))}
          </div>
        ) : null}
        {candidate ? (
          <div className="panel">
            <strong>{candidate.symbol}</strong>
            <p>
              {candidate.name} · {candidate.decimals} <Trans>decimals</Trans>
            </p>
            <p className="mono">{candidate.address}</p>
            <button
              onClick={() => {
                const imported = importCurrency(
                  importNetwork.chainId,
                  candidate,
                );
                choose(imported, importNetwork.chainId);
              }}
            >
              <Trans>Import token</Trans>
            </button>
          </div>
        ) : null}
        <ErrorText error={error} />
      </dialog>
    </>
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
    <Trans>Select token</Trans>
  );
}
