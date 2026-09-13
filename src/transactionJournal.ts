import { isAddress } from "viem";
import { load, save } from "./storage";

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
export type JournalEntry = {
  id: string;
  chainId: number;
  account: string;
  wallet?: { uuid?: string; rdns?: string; name?: string };
  hash?: string;
  batchId?: string;
  count: number;
  state: TransactionState;
  createdAt: number;
  updatedAt: number;
};
const key = "freelp:transaction-journal";
const listeners = new Set<() => void>();
const states: TransactionState[] = [
  "simulation",
  "awaiting wallet",
  "submitted",
  "confirming",
  "confirmed",
  "reverted",
  "unknown",
  "partial",
  "rejected",
];
export function isTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}
function text(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function positive(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function identifiersValid(entry: Partial<JournalEntry>) {
  if (entry.hash !== undefined && !isTransactionHash(entry.hash)) return false;
  if (entry.batchId !== undefined && !text(entry.batchId, 4096)) return false;
  return true;
}
function walletValid(wallet: JournalEntry["wallet"]) {
  if (wallet === undefined) return true;
  if (!wallet || typeof wallet !== "object") return false;
  return [wallet.uuid, wallet.name, wallet.rdns].every(
    (value) => value === undefined || text(value),
  );
}
function requiredValid(entry: JournalEntry) {
  return (
    text(entry.id) &&
    isAddress(entry.account ?? "") &&
    positive(entry.chainId) &&
    positive(entry.count) &&
    entry.count <= 4096
  );
}
function parseEntry(value: unknown): JournalEntry | undefined {
  if (!value || typeof value !== "object") return;
  const entry = value as JournalEntry;
  if (!requiredValid(entry)) return;
  if (
    !states.includes(entry.state) ||
    !positive(entry.createdAt) ||
    !positive(entry.updatedAt)
  )
    return;
  if (!identifiersValid(entry) || !walletValid(entry.wallet)) return;
  const {
    id,
    chainId,
    account,
    hash,
    batchId,
    count,
    state,
    createdAt,
    updatedAt,
  } = entry;
  const wallet = entry.wallet
    ? {
        uuid: entry.wallet.uuid,
        rdns: entry.wallet.rdns,
        name: entry.wallet.name,
      }
    : undefined;
  return {
    id,
    chainId,
    account,
    hash,
    batchId,
    count,
    state,
    createdAt,
    updatedAt,
    wallet,
  };
}
export function isUnresolved(entry: JournalEntry) {
  return ["awaiting wallet", "submitted", "confirming", "unknown"].includes(
    entry.state,
  );
}
export function loadJournal(): JournalEntry[] {
  const stored = load<{ version: number; entries: unknown[] } | null>(
    key,
    null,
  );
  if (stored?.version !== 1 || !Array.isArray(stored.entries)) return [];
  return stored.entries.flatMap((value) => {
    const entry = parseEntry(value);
    return entry ? [entry] : [];
  });
}
export function writeJournal(entries: JournalEntry[]) {
  const valid = entries.flatMap((value) => {
    const entry = parseEntry(value);
    return entry ? [entry] : [];
  });
  // Never evict an unresolved transaction to satisfy the completed-history cap.
  const keep = [
    ...valid.filter(isUnresolved),
    ...valid.filter((entry) => !isUnresolved(entry)).slice(-100),
  ].sort((a, b) => a.createdAt - b.createdAt);
  save(key, { version: 1, entries: keep });
  for (const listener of listeners) listener();
}
export function subscribeJournal(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  window.addEventListener("storage", changed);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", changed);
  };
}
export function upsertJournal(entry: JournalEntry) {
  writeJournal([
    ...loadJournal().filter((item) => item.id !== entry.id),
    entry,
  ]);
}
export function updateJournal(id: string, patch: Partial<JournalEntry>) {
  const entry = loadJournal().find((item) => item.id === id);
  if (entry) upsertJournal({ ...entry, ...patch, id, updatedAt: Date.now() });
}
export function unresolvedForScope(
  entries: JournalEntry[],
  chainId: number,
  account: string,
) {
  return entries.filter(
    (entry) =>
      entry.chainId === chainId &&
      entry.account.toLowerCase() === account.toLowerCase() &&
      isUnresolved(entry),
  );
}
export function journalId() {
  return crypto.randomUUID();
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
