import { errorMessage } from "./errors";
import { displayAmount } from "./displayAmount";
import { useEffect, useState } from "react";
import { formatUnits, getAddress, isAddress, zeroAddress } from "viem";
import { NativeMaxButton } from "./NativeMaxButton";
import type { Transaction } from "./types";
import { token, type Token } from "./contracts";
import { networkCurrencies, type Currency } from "./tokens";
import { useSession } from "./session";
import { useTokenBalances } from "./useTokenBalances";
type Props = {
  address: string;
  fallback: string;
  onAmount: (value: string) => void;
  disabled?: boolean;
  nativeCalls?: Transaction[];
};
export function TokenBalance(props: Props) {
  const { settings, account } = useSession();
  if (!account || !isAddress(props.address)) return null;
  const currency = networkCurrencies(settings).find(
    (t) => t.address.toLowerCase() === props.address.toLowerCase(),
  );
  return currency ? (
    <KnownBalance currency={currency} {...props} />
  ) : (
    <UnknownBalance {...props} />
  );
}
function KnownBalance({
  currency,
  onAmount,
  disabled,
  nativeCalls,
}: {
  currency: Currency;
} & Props) {
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
      disabled={disabled}
      nativeCalls={nativeCalls}
    />
  );
}
function UnknownBalance({
  address,
  fallback,
  onAmount,
  disabled,
  nativeCalls,
}: Props) {
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
  return (
    <BalanceActions
      value={current.token}
      onAmount={onAmount}
      disabled={disabled}
      nativeCalls={nativeCalls}
    />
  );
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
          <span>Balance unavailable</span>
          <button type="button" onClick={retry}>
            Retry balance
          </button>
        </>
      ) : (
        <span>Loading balance…</span>
      )}
    </div>
  );
}
function BalanceActions({
  value,
  onAmount,
  disabled,
  nativeCalls,
}: {
  value: Pick<Token, "address" | "symbol" | "decimals" | "balance">;
  onAmount: Props["onAmount"];
  disabled?: boolean;
  nativeCalls?: Transaction[];
}) {
  return (
    <div className="balance-actions">
      <small title={formatUnits(value.balance, value.decimals)}>
        Balance: {displayAmount(value.balance, value.decimals)} {value.symbol}
      </small>
      <div className="row">
        {(value.address === zeroAddress ? [25, 50] : [25, 50, 100]).map(
          (percent) => (
            <button
              key={percent}
              type="button"
              disabled={disabled}
              onClick={() =>
                onAmount(
                  formatUnits(
                    (value.balance * BigInt(percent)) / 100n,
                    value.decimals,
                  ),
                )
              }
            >
              {percent}%
            </button>
          ),
        )}
        {value.address === zeroAddress ? (
          <NativeMaxButton
            value={value}
            onAmount={onAmount}
            disabled={disabled}
            calls={nativeCalls}
          />
        ) : null}
      </div>
    </div>
  );
}
