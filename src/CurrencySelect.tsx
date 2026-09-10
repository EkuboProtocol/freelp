import { useId, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { erc20Abi, getAddress, isAddress } from "viem";
import { currencies, importCurrency, type Currency } from "./tokens";
import { useSession, rpc } from "./session";
import { Field, ErrorText } from "./common";

export function CurrencySelect({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (token: Currency) => void;
}) {
  const titleId = useId();
  const { settings } = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const tokens = currencies(settings.chainId);
  const [candidate, setCandidate] = useState<Currency>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = tokens.find(
    (token) => token.address.toLowerCase() === value.toLowerCase(),
  );
  const visible = tokens.filter((token) =>
    `${token.symbol} ${token.name} ${token.address}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function choose(token: Currency) {
    onChange(token);
    dialog.current?.close();
  }
  async function inspect() {
    setBusy(true);
    setError("");
    try {
      const address = getAddress(search);
      const client = rpc(settings);
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
          dialog.current?.showModal();
        }}
      >
        <span className="currency-mark">
          {selected?.symbol.slice(0, 1) ?? "+"}
        </span>
        <span>
          {selected?.symbol ?? <Trans>Select token</Trans>}{" "}
          <small>{selected?.name}</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      <dialog
        ref={dialog}
        className="currency-dialog"
        aria-labelledby={titleId}
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
        <Field label={<Trans>Search tokens or paste an address</Trans>}>
          <input
            name="token-search"
            spellCheck={false}
            autoComplete="off"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCandidate(undefined);
            }}
          />
        </Field>
        <div className="token-list">
          {visible.map((token) => (
            <button
              className="token-option"
              key={token.address}
              onClick={() => choose(token)}
            >
              <span className="currency-mark">{token.symbol.slice(0, 1)}</span>
              <span>
                <strong>{token.symbol}</strong>
                <small>{token.name}</small>
                <small className="mono">{token.address}</small>
              </span>
            </button>
          ))}
        </div>
        {isAddress(search) && !visible.length ? (
          <button disabled={busy} onClick={() => void inspect()}>
            <Trans>Read token from chain</Trans>
          </button>
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
                const imported = importCurrency(settings.chainId, candidate);
                choose(imported);
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
