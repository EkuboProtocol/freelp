import { toSqrtRatio } from "@ekubo/sdk";
import { useState } from "react";
import { formatUnits } from "viem";
import { type Token } from "./contracts";
import { parseAmount } from "./amounts";
import { quoteDeposit } from "./depositQuote";
import { errorMessage } from "./errors";
import type { Position } from "./types";

type Result = ReturnType<typeof calculateRatio>;
export function usePositionDeposit(
  position: Position,
  tokens?: [Token, Token],
) {
  const [input, setInput] = useState({ side: 0 as 0 | 1, value: "" });
  const inactive = [
    position.sqrtRatio >= toSqrtRatio(position.descriptor.tickUpper, "evm"),
    position.sqrtRatio <= toSqrtRatio(position.descriptor.tickLower, "evm"),
  ];
  const current = calculate(position, tokens, input);
  const amounts = [0, 1].map((i) => {
    if (inactive[i]) return "0";
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
    inactive,

    update: (side: 0 | 1, value: string) => setInput({ side, value }),
  };
}
function calculateRatio(
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

function calculate(
  position: Position,
  tokens: [Token, Token] | undefined,
  input: { side: 0 | 1; value: string },
): { result?: Result; error?: string } | undefined {
  if (!tokens) return;
  try {
    return { result: calculateRatio(position, tokens, input) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
