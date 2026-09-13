import { describe, expect, test } from "bun:test";
import {
  unresolvedForScope,
  type JournalEntry,
} from "../../src/transactionJournal";

const entry = (
  account: string,
  state: JournalEntry["state"],
): JournalEntry => ({
  id: `${account}-${state}`,
  chainId: 1,
  account,
  count: 1,
  state,
  createdAt: 1,
  updatedAt: 1,
});

describe("transaction journal scope", () => {
  test("blocks only unresolved work for the same account and chain", () => {
    const entries = [
      entry("0x1", "unknown"),
      entry("0x2", "submitted"),
      entry("0x1", "confirmed"),
    ];
    expect(unresolvedForScope(entries, 1, "0x1")).toHaveLength(1);
    expect(unresolvedForScope(entries, 2, "0x1")).toHaveLength(0);
    expect(unresolvedForScope(entries, 1, "0x3")).toHaveLength(0);
  });
});
