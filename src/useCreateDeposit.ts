import {
  useEffect,
  useEffectEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { formatUnits } from "viem";
import { useSession } from "./session";
import { useDepositTokens } from "./useDepositTokens";
import { calculateDepositQuote } from "./calculateDepositQuote";
import { errorMessage } from "./errors";
import type { CreateForm } from "./createForm";
import type { useSelectedPool } from "./useSelectedPool";

export function useCreateDeposit(
  form: CreateForm,
  pool: ReturnType<typeof useSelectedPool>,
  setMaxA: Dispatch<SetStateAction<string>>,
  setMaxB: Dispatch<SetStateAction<string>>,
) {
  const { settings, account, revision } = useSession();
  const { a, b, maxA, maxB, specified, fee, range } = form;
  const walletTokens = useDepositTokens({ settings, account, a, b }, revision);
  const key = JSON.stringify([
    settings,
    account,
    revision,
    pool.data?.key,
    a,
    b,
    [maxA, maxB][specified],
    fee,
    range,
    specified,
    form.kind,
    form.extension,
    form.exactFee,
    form.amplification,
    form.center,
  ]);
  const calculation = calculatePreview(
    pool.data && {
      settings,
      account,
      a,
      b,
      maxA,
      maxB,
      fee,
      range,
      specified,
      options: form,
      initialized: pool.data.state.sqrtRatio !== 0n,
      state: pool.data.state,
      tokens: walletTokens?.tokens,
    },
  );
  const current = calculation?.result;
  const previewError = calculation?.error ?? walletTokens?.error ?? "";
  const syncMatchingAmount = useEffectEvent(() => {
    if (!current) return;
    if (specified === 0)
      setMaxB(formatUnits(current.max1, current.tokens[1].decimals));
    else setMaxA(formatUnits(current.max0, current.tokens[0].decimals));
  });
  useEffect(() => {
    syncMatchingAmount();
  }, [key, pool.data]);
  return { current, ready: !!walletTokens?.tokens, previewError };
}
function calculatePreview(
  input: Parameters<typeof calculateDepositQuote>[0] | undefined,
) {
  if (!input || !(input.specified === 0 ? input.maxA : input.maxB)) return;
  try {
    return { result: calculateDepositQuote(input) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
