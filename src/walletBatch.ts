import { type Address } from "viem";
import { rpc } from "./rpc";
import { walletClient } from "./walletCalls";
import {
  assertWallet,
  executeTransaction,
  type TransactionObserver,
} from "./transactions";
import { walletRejected } from "./transactionStatus";
import { batchOutcome } from "./batchOutcome";
import { CREATE2_FACTORY, verifyDeploymentBatch } from "./deterministic";
import { switchWalletChain } from "./walletNetwork";
import { verifyCode } from "./contracts";
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";
import type { Provider, Settings, Transaction } from "./types";
export async function executeBatch(
  provider: Provider,
  account: Address,
  settings: Settings,
  calls: Transaction[],
  observer?: TransactionObserver,
) {
  if (calls.length === 1)
    return executeTransaction(provider, account, settings, calls[0], observer);
  const client = rpc(settings);
  observer?.({ state: "checking" });
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  await switchWalletChain(provider, settings);
  await assertWallet(provider, account, settings.chainId);
  if (
    calls.some(
      (call) => call.to?.toLowerCase() === CREATE2_FACTORY.toLowerCase(),
    )
  ) {
    await verifyDeploymentBatch(settings, calls);
  } else
    await Promise.all([
      verifyCode(settings, settings.core, "Core"),
      verifyCode(settings, DEFAULT_POOL_KEY_INDEX, "PoolKeyIndex"),
      verifyCode(settings, settings.manager, "FreeLP"),
    ]);
  const batch = calls.map((call) => {
    if (!call.to) throw new Error("Batch calls require a destination.");
    return { ...call, to: call.to };
  });
  await assertWallet(provider, account, settings.chainId);
  const wallet = walletClient(provider, account, settings);
  return submitBatch(wallet, settings, batch, observer);
}
async function submitBatch(
  wallet: ReturnType<typeof walletClient>,
  settings: Settings,
  batch: { to: Address; data: `0x${string}`; value?: bigint }[],
  observer?: TransactionObserver,
) {
  observer?.({ state: "awaiting wallet" });
  let id: string;
  try {
    ({ id } = await wallet.sendCalls({ calls: batch }));
  } catch (error) {
    const state = walletRejected(error) ? "rejected" : "unknown";
    observer?.({ state });
    throw new Error(
      state === "rejected"
        ? "Batch rejected in the wallet."
        : "Wallet batch submission outcome is unknown. Check your wallet for its status.",
      { cause: error },
    );
  }
  observer?.({ state: "submitted", batchId: id });
  // Never resubmit a pending or partially completed batch as separate calls.
  const result = await waitForBatch(wallet, id, observer);
  return finalizeBatch(settings, result, id, observer);
}
type CallsStatus = Awaited<
  ReturnType<ReturnType<typeof walletClient>["waitForCallsStatus"]>
>;
async function finalizeBatch(
  settings: Settings,
  result: CallsStatus,
  id: string,
  observer?: TransactionObserver,
) {
  observer?.({ state: "confirming", batchId: id });
  const outcome = await batchOutcome(settings, result).catch((error) => {
    observer?.({ state: "unknown", batchId: id });
    throw new Error(
      `Batch ${id} was submitted but its receipts cannot be verified. Check your wallet for its status.`,
      { cause: error },
    );
  });
  observer?.({ state: outcome.state, batchId: id });
  if (outcome.state !== "confirmed" || !outcome.receipt)
    throw new Error(
      `Batch ${id}: ${outcome.state}. Check your wallet for details and refresh balances.`,
    );
  return outcome.receipt;
}
async function waitForBatch(
  wallet: ReturnType<typeof walletClient>,
  id: string,
  observer?: TransactionObserver,
) {
  try {
    return await wallet.waitForCallsStatus({ id, throwOnFailure: false });
  } catch (error) {
    observer?.({ state: "unknown", batchId: id });
    throw new Error(
      `Batch ${id} confirmation is unknown. Check your wallet for its status.`,
      { cause: error },
    );
  }
}
