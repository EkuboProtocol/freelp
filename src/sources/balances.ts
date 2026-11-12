import {
  formatUnits,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
} from "viem";
import { token, type Token } from "../contracts";
import { displayAmount } from "../displayAmount";
import { errorMessage } from "../errors";
import { networkCurrencies } from "../tokens";
import { tokenBalances } from "../balances";
import { availableAfterReserve, estimateNativeReserve } from "../nativeGas";
import type { Settings, Transaction } from "../types";

// What a token's balance line shows: the amount, and the shares of it a
// person can fill in with one press (25%, 50%, 100%; Max for native).
export type Balance = {
  state: "none" | "loading" | "failed" | "ready";
  address: string;
  symbol: string;
  decimals: number;
  raw: string;
  exact: string;
  display: string;
  native: boolean;
  allowance: string;
  fractions: { label: string; amount: string }[];
};

export const NO_BALANCE: Balance = {
  state: "none",
  address: "",
  symbol: "",
  decimals: 0,
  raw: "0",
  exact: "0",
  display: "0",
  native: false,
  allowance: "0",
  fractions: [],
};

function view(
  value: Pick<Token, "address" | "symbol" | "decimals" | "balance"> & {
    allowance?: bigint;
  },
): Balance {
  const native = value.address === zeroAddress;
  return {
    state: "ready",
    address: value.address,
    symbol: value.symbol,
    decimals: value.decimals,
    raw: value.balance.toString(),
    exact: formatUnits(value.balance, value.decimals),
    display: displayAmount(value.balance, value.decimals),
    native,
    allowance: (value.allowance ?? 0n).toString(),
    fractions: (native ? [25, 50] : [25, 50, 100]).map((percent) => ({
      label: `${percent}%`,
      amount: formatUnits(
        (value.balance * BigInt(percent)) / 100n,
        value.decimals,
      ),
    })),
  };
}

// The balance of `address` held by `account`, from the network's catalog
// in one read when it is a known currency, else from the token itself.
export async function balanceView(
  settings: Settings,
  account: Address | undefined,
  address: string,
  fallbackDecimals: string,
  revision: number,
): Promise<Balance> {
  if (!account || !isAddress(address)) return NO_BALANCE;
  try {
    const currency = networkCurrencies(settings).find(
      (t) => t.address.toLowerCase() === address.toLowerCase(),
    );
    if (currency) {
      const balances = await tokenBalances(
        settings,
        account,
        networkCurrencies(settings).map((t) => t.address),
        revision,
        0,
      );
      return view({
        ...currency,
        balance: balances.get(currency.address.toLowerCase()) ?? 0n,
      });
    }
    return view(
      await token(
        settings,
        getAddress(address),
        account,
        fallbackDecimals === "" ? undefined : Number(fallbackDecimals),
      ),
    );
  } catch (error) {
    return { ...NO_BALANCE, state: "failed", symbol: errorMessage(error) };
  }
}

// Max for the native currency: the balance less a provisional gas reserve
// for `calls`, which the wallet replaces with its own estimate.
export async function nativeMax(
  settings: Settings,
  balance: bigint,
  decimals: number,
  symbol: string,
  calls: Transaction[],
) {
  if (!calls.length)
    return {
      ok: false,
      amount: "",
      message: "Enter an amount first to estimate a gas reserve for Max.",
    };
  try {
    const reserve = await estimateNativeReserve(settings, calls);
    return {
      ok: true,
      amount: formatUnits(availableAfterReserve(balance, reserve), decimals),
      message: `Provisional reserve: ${formatUnits(reserve, decimals)} ${symbol}, budgeting 1,000,000 gas per call. Your wallet sets the final gas.`,
    };
  } catch (error) {
    return { ok: false, amount: "", message: errorMessage(error) };
  }
}
