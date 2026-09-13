/** Transient progress for the current submission; never persisted or recovered. */
export type TransactionState =
  | "simulation"
  | "awaiting wallet"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "reverted"
  | "unknown"
  | "partial"
  | "rejected";

export function isTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function walletRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const pending: unknown[] = [error];
  for (let i = 0; i < 8 && pending.length; i++) {
    const value = pending.shift() as { code?: number; cause?: unknown };
    if (value.code === 4001) return true;
    if (value.cause && typeof value.cause === "object")
      pending.push(value.cause);
  }
  return false;
}
