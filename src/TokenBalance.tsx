import { errorMessage } from "./errors";
import { displayAmount } from "./displayAmount";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { formatUnits, getAddress, isAddress, zeroAddress } from "viem";
import { token, type Token } from "./contracts";
import { currencies, type Currency } from "./tokens";
import { useSession } from "./session";
import { useTokenBalances } from "./useTokenBalances";
type Props = {
  address: string;
  fallback: string;
  onAmount: (value: string) => void;
};
export function TokenBalance(props: Props) {
  const { settings, account } = useSession();
  if (!account || !isAddress(props.address)) return null;
  const currency = currencies(settings.chainId, settings.nativeSymbol).find(
    (t) => t.address.toLowerCase() === props.address.toLowerCase(),
  );
  return currency ? (
    <KnownBalance currency={currency} onAmount={props.onAmount} />
  ) : (
    <UnknownBalance {...props} />
  );
}
function KnownBalance({
  currency,
  onAmount,
}: {
  currency: Currency;
  onAmount: Props["onAmount"];
}) {
  const { settings } = useSession();
  const [refresh, setRefresh] = useState(0);
  const state = useTokenBalances([settings], true, refresh).get(
    settings.chainId,
  );
  if (!state?.balances)
    return (
      <BalanceStatus
        failed={!!state?.error}
        retry={() => setRefresh((n) => n + 1)}
      />
    );
  return (
    <BalanceActions
      value={{
        ...currency,
        balance: state.balances.get(currency.address.toLowerCase()) ?? 0n,
      }}
      onAmount={onAmount}
    />
  );
}
function UnknownBalance({ address, fallback, onAmount }: Props) {
  const { settings, account, revision } = useSession();
  const [refresh, setRefresh] = useState(0);
  const scope = JSON.stringify([
    settings,
    account,
    address,
    fallback,
    revision,
    refresh,
  ]);
  const [loaded, setLoaded] = useState<{
    scope: string;
    token?: Token;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    if (!account) return;
    void token(
      settings,
      getAddress(address),
      account,
      fallback === "" ? undefined : Number(fallback),
    )
      .then((token) => {
        if (active) setLoaded({ scope, token });
      })
      .catch((error) => {
        if (active) setLoaded({ scope, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [settings, account, address, fallback, revision, refresh, scope]);
  const current = loaded?.scope === scope ? loaded : undefined;
  if (!current?.token)
    return (
      <BalanceStatus
        failed={!!current?.error}
        retry={() => setRefresh((n) => n + 1)}
      />
    );
  return <BalanceActions value={current.token} onAmount={onAmount} />;
}
function BalanceStatus({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}) {
  return (
    <div className="balance-actions" role="status">
      {failed ? (
        <>
          <span>
            <Trans>Balance unavailable</Trans>
          </span>
          <button type="button" onClick={retry}>
            <Trans>Retry balance</Trans>
          </button>
        </>
      ) : (
        <span>
          <Trans>Loading balance…</Trans>
        </span>
      )}
    </div>
  );
}
function BalanceActions({
  value,
  onAmount,
}: {
  value: Pick<Token, "address" | "symbol" | "decimals" | "balance">;
  onAmount: Props["onAmount"];
}) {
  const percent = value.address === zeroAddress ? 95 : 100;
  return (
    <div className="balance-actions">
      <small title={formatUnits(value.balance, value.decimals)}>
        <Trans>Balance:</Trans> {displayAmount(value.balance, value.decimals)}{" "}
        {value.symbol}
      </small>
      <div className="row">
        <button
          type="button"
          onClick={() =>
            onAmount(formatUnits(value.balance / 2n, value.decimals))
          }
        >
          <Trans>Half</Trans>
        </button>
        <button
          type="button"
          onClick={() =>
            onAmount(
              formatUnits(
                (value.balance * BigInt(percent)) / 100n,
                value.decimals,
              ),
            )
          }
        >
          {percent === 100 ? <Trans>Max</Trans> : <Trans>Use 95%</Trans>}
        </button>
      </div>
    </div>
  );
}
