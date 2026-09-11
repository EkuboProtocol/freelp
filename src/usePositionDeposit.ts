import { toSqrtRatio } from "@ekubo/sdk";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { type Token } from "./contracts";
import { parseAmount } from "./amounts";
import { quoteDeposit } from "./depositQuote";
import { errorMessage } from "./errors";
import type { Position, Settings } from "./types";

type Result = Awaited<ReturnType<typeof loadRatio>>;
export function usePositionDeposit(
  settings: Settings,
  position: Position,
  tokens?: [Token, Token],
) {
  const [input, setInput] = useState({ side: 0 as 0 | 1, value: "" });
  const [loaded, setLoaded] = useState<{
    key: string;
    result?: Result;
    error?: string;
  }>();
  const key = JSON.stringify([
    settings,
    position.descriptor,
    position.sqrtRatio.toString(),
    tokens?.map((t) => t.decimals),
    input,
  ]);
  useEffect(() => {
    if (!tokens) return;
    let active = true;
    const timer = setTimeout(() => {
      void loadRatio(position, tokens, input)
        .then((result) => {
          if (active) setLoaded({ key, result });
        })
        .catch((error) => {
          if (active) setLoaded({ key, error: errorMessage(error) });
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, settings, position, tokens, input]);
  const current = loaded?.key === key ? loaded : undefined;
  const amounts = [0, 1].map((i) => {
    if (current?.result?.inactive[i]) return "0";
    if (i === input.side) return input.value;
    if (!current?.result || !tokens) return "";
    return formatUnits(
      i === 0 ? current.result.max0 : current.result.max1,
      tokens[i].decimals,
    );
  });
  return {
    amounts,
    result: current?.result,
    error: current?.error,
    pending: !!tokens && !current,
    update: (side: 0 | 1, value: string) => setInput({ side, value }),
  };
}
async function loadRatio(
  position: Position,
  tokens: [Token, Token],
  input: { side: 0 | 1; value: string },
) {
  const amounts: [bigint, bigint] = [0n, 0n];
  amounts[input.side] = parseAmount(
    input.value || "0",
    tokens[input.side].decimals,
  );
  const quote = quoteDeposit(
    position.descriptor,
    position.sqrtRatio,
    amounts,
    input.side,
  );
  return {
    ...quote,
    inactive: [
      position.sqrtRatio >= toSqrtRatio(position.descriptor.tickUpper, "evm"),
      position.sqrtRatio <= toSqrtRatio(position.descriptor.tickLower, "evm"),
    ],
  };
}
