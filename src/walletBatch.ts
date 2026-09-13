import { type Address } from "viem";
import { rpc } from "./rpc";
import { walletClient } from "./walletCalls";
import {
  assertWallet,
  executeTransaction,
  type TransactionObserver,
  type WalletIdentity,
} from "./transactions";
import {
  journalId,
  upsertJournal,
  updateJournal,
  walletRejected,
} from "./transactionJournal";
import { batchOutcome } from "./batchOutcome";
import { assertNativeFunding, paddedGas } from "./nativeGas";
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
  walletIdentity?: WalletIdentity,
) {
  if (calls.length === 1)
    return executeTransaction(
      provider,
      account,
      settings,
      calls[0],
      observer,
      walletIdentity,
    );
  const client = rpc(settings);
  observer?.({ state: "simulation" });
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match settings.");
  await switchWalletChain(provider, settings);
  await assertWallet(provider, account, settings.chainId);
  await Promise.all([
    verifyCode(settings, settings.core, "Core"),
    verifyCode(settings, DEFAULT_POOL_KEY_INDEX, "PoolKeyIndex"),
    verifyCode(settings, settings.manager, "FreeLP"),
  ]);
  const batch = calls.map((call) => {
    if (!call.to) throw new Error("Batch calls require a destination.");
    return { ...call, to: call.to };
  });
  // Sequential simulation preserves approvals for the following deposit.
  const simulation = await client
    .simulateCalls({ account, calls: batch })
    .catch(() => {
      throw new Error(
        "Unable to simulate this batch. Change this network’s RPC URL in Networks and retry.",
      );
    });
  if (
    simulation.results.length !== calls.length ||
    simulation.results.some((result) => result.status !== "success")
  )
    throw new Error(
      "The batch simulation failed. Review the deposit amounts and approvals.",
    );
  await assertNativeFunding(
    settings,
    account,
    simulation.results.reduce(
      (sum, result) => sum + paddedGas(result.gasUsed),
      0n,
    ),
    calls.reduce((sum, call) => sum + (call.value ?? 0n), 0n),
  );
  await assertWallet(provider, account, settings.chainId);
  const wallet = walletClient(provider, account, settings);
  return submitBatch(
    wallet,
    account,
    settings,
    calls,
    batch,
    observer,
    walletIdentity,
  );
}
async function submitBatch(
  wallet: ReturnType<typeof walletClient>,
  account: Address,
  settings: Settings,
  calls: Transaction[],
  batch: { to: Address; data: `0x${string}`; value?: bigint }[],
  observer?: TransactionObserver,
  walletIdentity?: WalletIdentity,
) {
  const journal = journalId();
  upsertJournal({
    id: journal,
    chainId: settings.chainId,
    account,
    wallet: walletIdentity,
    count: calls.length,
    state: "awaiting wallet",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  observer?.({ state: "awaiting wallet" });
  let id: string;
  try {
    ({ id } = await wallet.sendCalls({ calls: batch }));
  } catch (error) {
    const state = walletRejected(error) ? "rejected" : "unknown";
    updateJournal(journal, { state });
    observer?.({ state });
    throw new Error(
      state === "rejected"
        ? "Batch rejected in the wallet."
        : "Wallet batch submission outcome is unknown. Check transaction activity before retrying.",
      { cause: error },
    );
  }
  upsertJournal({
    id: journal,
    chainId: settings.chainId,
    account,
    wallet: walletIdentity,
    batchId: id,
    count: calls.length,
    state: "submitted",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  observer?.({ state: "submitted", batchId: id });
  // Never resubmit a pending or partially completed batch as separate calls.
  const result = await waitForBatch(wallet, id, journal, observer);
  return finalizeBatch(settings, result, id, journal, observer);
}
type CallsStatus = Awaited<
  ReturnType<ReturnType<typeof walletClient>["waitForCallsStatus"]>
>;
async function finalizeBatch(
  settings: Settings,
  result: CallsStatus,
  id: string,
  journal: string,
  observer?: TransactionObserver,
) {
  updateJournal(journal, { state: "confirming" });
  observer?.({ state: "confirming", batchId: id });
  const outcome = await batchOutcome(settings, result).catch((error) => {
    updateJournal(journal, { state: "unknown" });
    observer?.({ state: "unknown", batchId: id });
    throw new Error(
      `Batch ${id} was submitted but its receipts cannot be verified. Check status before retrying.`,
      { cause: error },
    );
  });
  updateJournal(journal, { state: outcome.state });
  observer?.({ state: outcome.state, batchId: id });
  if (outcome.state !== "confirmed" || !outcome.receipt)
    throw new Error(
      `Batch ${id}: ${outcome.state}. Refresh transaction activity and balances before another action.`,
    );
  return outcome.receipt;
}
async function waitForBatch(
  wallet: ReturnType<typeof walletClient>,
  id: string,
  journal: string,
  observer?: TransactionObserver,
) {
  try {
    return await wallet.waitForCallsStatus({ id, throwOnFailure: false });
  } catch (error) {
    updateJournal(journal, { state: "unknown" });
    observer?.({ state: "unknown", batchId: id });
    throw new Error(
      `Batch ${id} confirmation is unknown. Check transaction activity before retrying.`,
      { cause: error },
    );
  }
}
