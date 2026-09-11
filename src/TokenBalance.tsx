import { displayAmount } from "./displayAmount";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { formatUnits, getAddress, isAddress, zeroAddress } from "viem";
import { token, type Token } from "./contracts";
import { useSession } from "./session";
export function TokenBalance({
  address,
  fallback,
  onAmount,
}: {
  address: string;
  fallback: string;
  onAmount: (value: string) => void;
}) {
  const { settings, account, revision } = useSession();
  const scope = JSON.stringify([
    settings,
    account,
    address,
    fallback,
    revision,
  ]);
  const [loaded, setLoaded] = useState<{ scope: string; token: Token }>();
  useEffect(() => {
    let active = true;
    if (!account || !isAddress(address)) return;
    token(
      settings,
      getAddress(address),
      account,
      fallback === "" ? undefined : Number(fallback),
    )
      .then((token) => {
        if (active) setLoaded({ scope, token });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [settings, account, address, fallback, revision, scope]);
  if (loaded?.scope !== scope) return null;
  const value = loaded.token;
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
