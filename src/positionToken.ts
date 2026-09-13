import { erc20Abi, maxUint256, zeroAddress, type Address } from "viem";
import { nativeCurrency } from "./nativeCurrency";
import { rpc } from "./rpc";
import type { Settings } from "./types";
import type { Token } from "./contracts";
import { networkCurrencies } from "./tokens";

export type PositionTokenRead = {
  token: Token;
  balanceReady: boolean;
  allowanceReady: boolean;
  metadataReady: boolean;
  error?: string;
};

export async function readPositionToken(
  settings: Settings,
  address: Address,
  holder: Address,
  previous?: Token,
): Promise<PositionTokenRead> {
  if (address === zeroAddress)
    return readNativeToken(settings, holder, previous);
  const result = await readErc20Token(settings, address, holder, previous);
  const known = networkCurrencies(settings).find(
    (currency) => currency.address.toLowerCase() === address.toLowerCase(),
  );
  return known
    ? {
        ...result,
        token: {
          ...result.token,
          symbol: known.symbol,
          decimals: known.decimals,
          metadataMissing: false,
        },
        metadataReady: true,
      }
    : result;
}

async function readNativeToken(
  settings: Settings,
  holder: Address,
  previous?: Token,
): Promise<PositionTokenRead> {
  const base = {
    address: zeroAddress,
    ...nativeCurrency(settings),
    allowance: maxUint256,
    metadataMissing: false,
  };
  try {
    return {
      token: {
        ...base,
        balance: await rpc(settings).getBalance({ address: holder }),
      },
      balanceReady: true,
      allowanceReady: true,
      metadataReady: true,
    };
  } catch {
    return {
      token: { ...base, balance: previous?.balance ?? 0n },
      balanceReady: false,
      allowanceReady: true,
      metadataReady: true,
      error: "Could not read the native-token balance.",
    };
  }
}

async function readErc20Token(
  settings: Settings,
  address: Address,
  holder: Address,
  previous?: Token,
): Promise<PositionTokenRead> {
  const client = rpc(settings);
  const [symbol, decimals, balance, allowance] = await Promise.allSettled([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({
      address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [holder],
    }),
    client.readContract({
      address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [holder, settings.manager],
    }),
  ]);
  const balanceReady = balance.status === "fulfilled";
  const allowanceReady = allowance.status === "fulfilled";
  const metadataReady =
    symbol.status === "fulfilled" && decimals.status === "fulfilled";
  const error = spendError(balanceReady, allowanceReady);
  return {
    token: erc20Snapshot(
      address,
      previous,
      symbol,
      decimals,
      balance,
      allowance,
    ),
    balanceReady,
    allowanceReady,
    metadataReady,
    error,
  };
}

function spendError(balanceReady: boolean, allowanceReady: boolean) {
  const errors: string[] = [];
  if (!balanceReady) errors.push("Could not read the token balance.");
  if (!allowanceReady) errors.push("Could not read the token allowance.");
  return errors.length ? errors.join(" ") : undefined;
}

function erc20Snapshot(
  address: Address,
  previous: Token | undefined,
  symbol: PromiseSettledResult<unknown>,
  decimals: PromiseSettledResult<unknown>,
  balance: PromiseSettledResult<unknown>,
  allowance: PromiseSettledResult<unknown>,
): Token {
  const symbolValue = fulfilledValue(symbol, (value) => String(value));
  const decimalsValue = fulfilledValue(decimals, Number);
  const validDecimals =
    decimalsValue !== undefined &&
    Number.isInteger(decimalsValue) &&
    decimalsValue >= 0 &&
    decimalsValue <= 255
      ? decimalsValue
      : undefined;
  return {
    address,
    symbol: snapshotString(symbolValue, previous?.symbol, address),
    decimals: validDecimals ?? 0,
    balance: snapshotBigint(settledBigint(balance), previous?.balance),
    allowance: snapshotBigint(settledBigint(allowance), previous?.allowance),
    metadataMissing: validDecimals === undefined,
  };
}

function snapshotString(
  value: string | undefined,
  previous: string | undefined,
  address: string,
) {
  return (value?.trim() || previous?.trim() || address).slice(0, 32);
}

function snapshotBigint(
  value: bigint | undefined,
  previous: bigint | undefined,
) {
  return value ?? previous ?? 0n;
}

function fulfilledValue<T, R>(
  result: PromiseSettledResult<T>,
  map: (value: T) => R,
) {
  return result.status === "fulfilled" ? map(result.value) : undefined;
}

function settledBigint(result: PromiseSettledResult<unknown>) {
  return fulfilledValue(result, (value) => BigInt(value as bigint));
}
