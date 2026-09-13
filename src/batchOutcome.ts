import type { GetCallsStatusReturnType } from "viem";
import { rpc } from "./rpc";
import type { Settings } from "./types";
import { isTransactionHash, type TransactionState } from "./transactionJournal";

export async function batchOutcome(
  settings: Settings,
  result: GetCallsStatusReturnType,
) {
  const client = rpc(settings);
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain ID does not match this transaction.");
  if (result.chainId !== undefined && result.chainId !== settings.chainId)
    throw new Error("Wallet returned batch status for a different chain.");
  if (result.status === "pending")
    return { state: "submitted" as TransactionState };
  const receipts = result.receipts ?? [];
  if (receipts.length === 0) {
    const rejected = result.statusCode >= 300 && result.statusCode < 500;
    return { state: rejected ? ("rejected" as const) : ("unknown" as const) };
  }
  const verified = await Promise.all(
    receipts.map(async (receipt) => {
      if (!isTransactionHash(receipt.transactionHash))
        throw new Error("Wallet returned an invalid receipt hash.");
      const actual = await client.getTransactionReceipt({
        hash: receipt.transactionHash,
      });
      if (
        actual.transactionHash.toLowerCase() !==
          receipt.transactionHash.toLowerCase() ||
        actual.blockHash !== receipt.blockHash ||
        actual.status !== receipt.status
      )
        throw new Error(
          "Wallet and RPC disagree about the batch receipt. Check status again.",
        );
      return actual;
    }),
  );
  const state = terminalBatchState(
    result.statusCode,
    verified.map((receipt) => receipt.status),
  );
  return { state, receipt: verified.at(-1) };
}

export function terminalBatchState(
  code: number,
  statuses: ("success" | "reverted")[],
): TransactionState {
  if (!statuses.length) return "unknown";
  if (
    code >= 200 &&
    code < 300 &&
    statuses.every((status) => status === "success")
  )
    return "confirmed";
  if (
    code >= 500 &&
    code < 600 &&
    statuses.every((status) => status === "reverted")
  )
    return "reverted";
  if (code >= 600 && code < 700) return "partial";
  return "unknown";
}
