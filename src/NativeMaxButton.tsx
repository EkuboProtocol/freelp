import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useSession } from "./session";
import { availableAfterReserve, estimateNativeReserve } from "./nativeGas";
import { errorMessage } from "./errors";
import type { Token } from "./contracts";
import type { Transaction } from "./types";

export function NativeMaxButton({
  value,
  calls,
  onAmount,
  disabled,
}: {
  value: Pick<Token, "balance" | "decimals" | "symbol">;
  calls?: Transaction[];
  onAmount: (value: string) => void;
  disabled?: boolean;
}) {
  const { settings, account, busy } = useSession();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef({ version: 0 });
  const scope = JSON.stringify([
    settings,
    account,
    value.balance.toString(),
    calls?.map((tx) => [tx.to, tx.data, tx.value?.toString()]),
  ]);
  useEffect(() => {
    const guard = request.current;
    return () => {
      guard.version++;
    };
  }, [scope]);
  async function maximum() {
    if (!account || !calls?.length || pending) return;
    const id = ++request.current.version;
    setPending(true);
    setMessage("Estimating gas for this draft and its approvals…");
    try {
      const reserve = await estimateNativeReserve(settings, account, calls);
      if (id !== request.current.version) return;
      onAmount(
        formatUnits(
          availableAfterReserve(value.balance, reserve),
          value.decimals,
        ),
      );
      setMessage(
        `Estimated gas reserve: ${formatUnits(reserve, value.decimals)} ${value.symbol}. Final network cost may change.`,
      );
    } catch (error) {
      if (id === request.current.version) setMessage(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled || busy || pending || !calls?.length}
        aria-busy={pending}
        onClick={() => void maximum()}
      >
        Max available
      </button>
      <small role="status">
        {message || "Enter an amount first to estimate a gas reserve for Max."}
      </small>
    </>
  );
}
