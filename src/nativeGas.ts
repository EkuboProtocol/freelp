import { Eip1559FeesNotSupportedError, type Address } from "viem";
import { rpc } from "./rpc";
import type { Settings, Transaction } from "./types";

export function paddedGas(gas: bigint) {
  return gas + (gas + 4n) / 5n;
}

export function availableAfterReserve(balance: bigint, reserve: bigint) {
  if (balance < 0n || reserve <= 0n)
    throw new Error("A positive gas reserve is required.");
  return balance > reserve ? balance - reserve : 0n;
}

export async function nativeFeeCeiling(settings: Settings) {
  const client = rpc(settings);
  const price = await client
    .estimateFeesPerGas()
    .then((fees) => fees.maxFeePerGas ?? fees.gasPrice)
    .catch((error) => {
      if (error instanceof Eip1559FeesNotSupportedError)
        return client.getGasPrice();
      throw error;
    });
  if (price === undefined || price <= 0n)
    throw new Error(
      "RPC did not return a usable gas price. Enter an amount leaving native currency for gas.",
    );
  return price;
}

/** A provisional reserve calibrated to the actual draft, including approvals.
 * The final transaction is estimated again before requesting the wallet. */
export async function estimateNativeReserve(
  settings: Settings,
  account: Address,
  calls: Transaction[],
) {
  if (!calls.length)
    throw new Error("Enter a valid deposit amount before estimating Max.");
  const client = rpc(settings);
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  const [price, simulation] = await Promise.all([
    nativeFeeCeiling(settings),
    client.simulateCalls({
      account,
      calls: calls.map((call) => {
        if (!call.to)
          throw new Error("Gas estimate requires a transaction destination.");
        return { ...call, to: call.to };
      }),
    }),
  ]);
  if (
    simulation.results.length !== calls.length ||
    simulation.results.some((result) => result.status !== "success")
  )
    throw new Error(
      "Cannot estimate gas for this draft. Check balances, approvals, and the selected range.",
    );
  const gas = simulation.results.reduce(
    (sum, result) => sum + paddedGas(result.gasUsed),
    0n,
  );
  if (gas <= 0n) throw new Error("RPC did not return a usable gas estimate.");
  return gas * price;
}

export async function assertNativeFunding(
  settings: Settings,
  account: Address,
  gas: bigint,
  value: bigint,
) {
  const [balance, price] = await Promise.all([
    rpc(settings).getBalance({ address: account, blockTag: "pending" }),
    nativeFeeCeiling(settings),
  ]);
  if (balance < value + gas * price)
    throw new Error(
      `Insufficient ${settings.nativeSymbol} for the deposit and estimated network gas. Reduce the amount and retry.`,
    );
}
