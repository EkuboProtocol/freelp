import { TokenPickerRows, PickerBalanceStatus } from "./TokenPickerRows";
import { tokenPickerKeyboard } from "./tokenPickerKeyboard";
import { useTokenBalances } from "./useTokenBalances";
import { networkName } from "./networks";
import type { Settings } from "./types";
import { useId, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { erc20Abi, getAddress, isAddress } from "viem";
import { currencies, importCurrency, type Currency } from "./tokens";
import { useSession, rpc } from "./session";
import { ErrorText } from "./common";

export function CurrencySelect({
  value,
  label,
  onChange,
  allNetworks = false,
}: {
  value: string;
  label: string;
  onChange: (token: Currency, chainId: number) => void;
  allNetworks?: boolean;
}) {
  const titleId = useId();
  const { settings, networks, account } = useSession();
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const tokens = currencies(settings.chainId, settings.nativeSymbol);
  const [importNetwork, setImportNetwork] = useState(settings);
  const [candidate, setCandidate] = useState<Currency>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = tokens.find(
    (token) => token.address.toLowerCase() === value.toLowerCase(),
  );
  const choices = allNetworks ? networks : [settings];
  const balances = useTokenBalances(choices, open, refresh);
  const visible = choices
    .flatMap((network) =>
      currencies(network.chainId, network.nativeSymbol).map((token) => ({
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
    setBusy(true);
    setImportNetwork(network);
    setError("");
    try {
      const address = getAddress(search);
      const client = rpc(network);
      const [symbol, name, decimals] = await Promise.all([
        client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
        client.readContract({ address, abi: erc20Abi, functionName: "name" }),
        client.readContract({
          address,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);
      setCandidate({ address, symbol, name, decimals });
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="currency-select"
        aria-label={label}
        onClick={() => {
          setSearch("");
          setCandidate(undefined);
          setError("");
          setOpen(true);
          dialog.current?.showModal();
          searchInput.current?.focus();
        }}
      >
        <span className="currency-mark">
          {selected?.symbol.slice(0, 1) ?? "+"}
        </span>
        <span>
          {selected?.symbol ?? <Trans>Select token</Trans>}{" "}
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
