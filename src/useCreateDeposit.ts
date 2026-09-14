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
import { poolRange } from "./poolOptions";
import { poolInitialized } from "./poolData";
import type { CreateForm } from "./createForm";
import type { useSelectedPool } from "./useSelectedPool";

export function useCreateDeposit(
  form: CreateForm,
  pool: ReturnType<typeof useSelectedPool>,
  setMaxA: Dispatch<SetStateAction<string>>,
  setMaxB: Dispatch<SetStateAction<string>>,
) {
  const { settings, account, revision } = useSession();
  const { a, b, maxA, maxB, specified, range } = form;
  const walletTokens = useDepositTokens({ settings, account, a, b }, revision);
  const key = depositKey({ settings, account, revision, pool, form });
  const calculation = previewFor({
    settings,
    account,
    form,
    pool,
    walletTokens,
  });
  const current = calculation?.result;
  const previewError = calculation?.error ?? walletTokens?.error ?? "";
  const syncMatchingAmount = useEffectEvent(() => {
    syncAmount({ current, pool, specified, maxA, maxB, setMaxA, setMaxB });
  });
  useEffect(() => {
    syncMatchingAmount();
  }, [key, pool.data]);
  return {
    current,
    ready: !!walletTokens?.tokens,
    previewError,
    inactive: current?.inactive ?? inactiveSide(pool.data, range, form),
    refresh: () => {
      walletTokens?.refresh();
      pool.refresh();
    },
  };
}

function depositKey({
  settings,
  account,
  revision,
  pool,
  form,
}: {
  settings: ReturnType<typeof useSession>["settings"];
  account: ReturnType<typeof useSession>["account"];
  revision: number;
  pool: ReturnType<typeof useSelectedPool>;
  form: CreateForm;
}) {
  return JSON.stringify([
    settings,
    account,
    revision,
    pool.data?.key,
    form.a,
    form.b,
    form["maxA"],
    form["maxB"],
    form.fee,
    form.range,
    form.specified,
    form.kind,
    form.extension,
    form.exactFee,
    form.amplification,
    form.center,
  ]);
}

function previewFor({
  settings,
  account,
  form,
  pool,
  walletTokens,
}: {
  settings: ReturnType<typeof useSession>["settings"];
  account: ReturnType<typeof useSession>["account"];
  form: CreateForm;
  pool: ReturnType<typeof useSelectedPool>;
  walletTokens: ReturnType<typeof useDepositTokens>;
}) {
  const data = pool.data;
  if (!data) return undefined;
  return calculatePreview({
    settings,
    account,
    a: form.a,
    b: form.b,
    maxA: form.maxA,
    maxB: form.maxB,
    fee: form.fee,
    range: form.range,
    specified: form.specified,
    options: form,
    initialized: poolInitialized(data.state),
    state: data.state,
    tokens: walletTokens.tokens,
  });
}

function syncAmount({
  current,
  pool,
  specified,
  maxA,
  maxB,
  setMaxA,
  setMaxB,
}: {
  current?: ReturnType<typeof calculateDepositQuote>;
  pool: ReturnType<typeof useSelectedPool>;
  specified: 0 | 1;
  maxA: string;
  maxB: string;
  setMaxA: Dispatch<SetStateAction<string>>;
  setMaxB: Dispatch<SetStateAction<string>>;
}) {
  if (!pool.data || !current) return;
  const value = matchingAmount(current, specified);
  const previous = specified === 0 ? maxB : maxA;
  if (value !== previous) otherSetter(specified, setMaxA, setMaxB)(value);
}
function otherSetter(
  specified: 0 | 1,
  setMaxA: Dispatch<SetStateAction<string>>,
  setMaxB: Dispatch<SetStateAction<string>>,
) {
  return specified === 0 ? setMaxB : setMaxA;
}
function matchingAmount(
  current: ReturnType<typeof calculateDepositQuote>,
  specified: 0 | 1,
) {
  const index = specified === 0 ? 1 : 0;
  return formatUnits(
    specified === 0 ? current.max1 : current.max0,
    current.tokens[index].decimals,
  );
}

function inactiveSide(
  pool: ReturnType<typeof useSelectedPool>["data"],
  range: CreateForm["range"],
  options: CreateForm,
) {
  if (!pool) return [false, false] as [boolean, boolean];
  try {
    const { lower, upper, initial } = poolRange(
      range,
      ...pool.decimals,
      pool.state.sqrtRatio !== 0n,
      options,
    );
    const tick = pool.state.sqrtRatio === 0n ? initial : pool.state.tick;
    return [tick >= upper, tick <= lower] as [boolean, boolean];
  } catch {
    return [false, false] as [boolean, boolean];
  }
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
