import { useEffect, useState } from "react";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { networkCurrencies } from "./tokens";
import { tokenSnapshot } from "./balances";
import type { Settings } from "./types";
import type { Token } from "./contracts";
import { errorMessage } from "./errors";
type TokenInput = {
  settings: Settings;
  account?: Address;
  a: string;
  b: string;
};
async function loadTokens(input: TokenInput, revision: number) {
  const metadata = networkCurrencies(input.settings);
  const tokens = [input.a, input.b].map((address) => {
    const currency = metadata.find(
      (entry) => entry.address.toLowerCase() === address.toLowerCase(),
    );
    if (!currency)
      throw new Error(
        "Import this token's on-chain metadata before creating a position.",
      );
    return currency;
  });
  const { balances, allowances } = await tokenSnapshot(
    input.settings,
    input.account!,
    metadata.map((token) => token.address),
    revision,
    0,
  );
  const result = tokens.map((currency) => ({
    ...currency,
    balance: balances.get(currency.address.toLowerCase()) ?? 0n,
    allowance:
      currency.address === zeroAddress
        ? (1n << 256n) - 1n
        : (allowances.get(currency.address.toLowerCase()) ?? 0n),
    metadataMissing: false,
  }));
  return [result[0], result[1]] as [
    import("./contracts").Token,
    import("./contracts").Token,
  ];
}

export function useDepositTokens(input: TokenInput, revision: number) {
  const key = JSON.stringify([input, revision]);
  const [loaded, setLoaded] = useState<{
    key: string;
    tokens?: [Token, Token];
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    const [request, currentRevision] = JSON.parse(key) as [TokenInput, number];
    if (!request.account || !request.a || !request.b) return;
    void loadTokens(request, currentRevision).then(
      (tokens) => {
        if (active) setLoaded({ key, tokens });
      },
      (error) => {
        if (active) setLoaded({ key, error: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [key]);
  return loaded?.key === key ? loaded : undefined;
}
