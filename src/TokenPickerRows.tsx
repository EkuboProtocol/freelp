import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { formatUnits } from "viem";
import { networkName } from "./networks";
import { displayAmount } from "./displayAmount";
import type { Currency } from "./tokens";
import type { Settings } from "./types";
import type { BalanceState } from "./useTokenBalances";
export type PickerEntry = { token: Currency; network: Settings };
export function TokenPickerRows({
  entries,
  balances,
  connected,
  choose,
}: {
  entries: PickerEntry[];
  balances: Map<number, BalanceState>;
  connected: boolean;
  choose: (token: Currency, chainId: number) => void;
}) {
  const held = entries.filter(
    ({ token, network }) =>
      (balances
        .get(network.chainId)
        ?.balances?.get(token.address.toLowerCase()) ?? 0n) > 0n,
  );
  const rest = entries.filter((entry) => !held.includes(entry));
  return (
    <>
      {[...held, ...rest].map(({ token, network }) => (
        <button
          type="button"
          className="token-option"
          key={`${network.chainId}:${token.address}`}
          onClick={() => choose(token, network.chainId)}
          title={token.address}
        >
          <span className="currency-mark" aria-hidden="true">
            {token.symbol.slice(0, 2)}
          </span>
          <span className="token-identity">
            <strong title={token.name}>{token.symbol}</strong>
            <span className="token-network">
              {networkName(network.chainId, network.name)}
            </span>
          </span>
          <TokenRowBalance
            token={token}
            state={balances.get(network.chainId)}
            connected={connected}
          />
        </button>
      ))}
      {!entries.length ? (
        <p className="token-empty">
          <Trans>
            No matching tokens. Paste a contract address to import one.
          </Trans>
        </p>
      ) : null}
    </>
  );
}
function TokenRowBalance({
  token,
  state,
  connected,
}: {
  token: Currency;
  state?: BalanceState;
  connected: boolean;
}) {
  if (!connected)
    return (
      <span className="token-address" title={token.address}>
        {token.address.slice(0, 6)}…{token.address.slice(-4)}
      </span>
    );
  if (!state)
    return (
      <span className="token-row-balance" aria-label={t`Loading balance`}>
        …
      </span>
    );
  if (!state.balances)
    return (
      <span className="token-row-balance" title={t`Balance unavailable`}>
        —
      </span>
    );
  const balance = state.balances.get(token.address.toLowerCase()) ?? 0n;
  return (
    <span
      className="token-row-balance"
      title={t`Balance: ${formatUnits(balance, token.decimals)}`}
    >
      <strong>{displayAmount(balance, token.decimals)}</strong>
    </span>
  );
}

export function PickerBalanceStatus({
  connected,
  balances,
}: {
  connected: boolean;
  balances: Map<number, BalanceState>;
}) {
  if (!connected) return null;
  return (
    <>
      {[...balances.values()].some((state) => state.error) ? (
        <p className="balance-error">
          <Trans>
            Some balances could not be loaded. Refresh or check your RPC
            settings.
          </Trans>
        </p>
      ) : null}
    </>
  );
}
