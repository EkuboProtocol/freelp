import { expect, test } from "bun:test";
import { executeTransaction } from "../../src/transactions";
import {
  loadJournal,
  writeJournal,
  unresolvedForScope,
  type JournalEntry,
} from "../../src/transactionJournal";
import { recoverEntry, sameWallet } from "../../src/useTransactionRecovery";
import { terminalBatchState } from "../../src/batchOutcome";
import { DEFAULT_SETTINGS } from "../../src/config";
import { gasRpcReply } from "../support/gasRpc";

const account = "0x1111111111111111111111111111111111111111";
const hash = `0x${"12".repeat(32)}`;
const blockHash = `0x${"34".repeat(32)}`;
const wallet = { name: "Test wallet", uuid: "first-session" };

function receipt(transactionHash: string, status = "0x1") {
  return {
    transactionHash,
    blockHash,
    blockNumber: "0x1",
    from: account,
    to: account,
    contractAddress: null,
    cumulativeGasUsed: "0x5208",
    effectiveGasPrice: "0x1",
    gasUsed: "0x5208",
    logs: [],
    logsBloom: `0x${"00".repeat(256)}`,
    status,
    transactionIndex: "0x0",
    type: "0x2",
  };
}

test("submitted identifier survives an invalid receipt; status-only recovery verifies its chain and hash", async () => {
  writeJournal([]);
  let wrongReceipt = true;
  let chainId = "0x1";
  let sends = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();
      const values: Record<string, unknown> = {
        eth_chainId: chainId,
        eth_call: "0x",
        eth_estimateGas: "0x5208",
        eth_blockNumber: "0x1",
        eth_getTransactionReceipt: receipt(
          wrongReceipt ? `0x${"99".repeat(32)}` : hash,
        ),
      };
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: values[body.method] ?? gasRpcReply(body.method),
      });
    },
  });
  const settings = { ...DEFAULT_SETTINGS, rpcUrl: server.url.href };
  const provider = {
    request: async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [account];
      if (method === "eth_sendTransaction") {
        sends++;
        return hash;
      }
      return "0x1";
    },
  };
  try {
    await expect(
      executeTransaction(
        provider,
        account,
        settings,
        { data: "0x00" },
        undefined,
        wallet,
      ),
    ).rejects.toThrow("confirmation is unknown");
    const entry = loadJournal()[0];
    expect(entry.hash).toBe(hash);
    expect(entry.state).toBe("unknown");
    expect(unresolvedForScope(loadJournal(), 1, account)).toHaveLength(1);
    expect(unresolvedForScope(loadJournal(), 8453, account)).toHaveLength(0);
    wrongReceipt = false;
    chainId = "0x2105";
    await expect(
      recoverEntry(entry.id, provider, account, [settings], wallet),
    ).rejects.toThrow("chain ID");
    expect(loadJournal()[0].state).toBe("unknown");
    chainId = "0x1";
    expect(
      await recoverEntry(entry.id, provider, account, [settings], wallet),
    ).toBe(true);
    expect(loadJournal()[0].state).toBe("confirmed");
    expect(sends).toBe(1);
  } finally {
    server.stop(true);
    writeJournal([]);
  }
});

test("batch state distinguishes pending, verified success, complete revert and partial failure", () => {
  expect(terminalBatchState(100, ["success"])).toBe("unknown");
  // One atomic transaction may implement several requested calls.
  expect(terminalBatchState(200, ["success"])).toBe("confirmed");
  expect(terminalBatchState(200, ["success", "reverted"])).toBe("unknown");
  expect(terminalBatchState(500, ["reverted"])).toBe("reverted");
  expect(terminalBatchState(600, ["success", "reverted"])).toBe("partial");
  expect(terminalBatchState(200, [])).toBe("unknown");
  expect(sameWallet(wallet, { ...wallet, uuid: "new-session" })).toBe(true);
  expect(sameWallet(wallet, { name: "Different wallet" })).toBe(false);
});

test("completed-history cap never evicts unresolved requests", () => {
  const entry: JournalEntry = {
    id: "pending",
    chainId: 1,
    account,
    count: 1,
    state: "awaiting wallet",
    createdAt: 1,
    updatedAt: 1,
  };
  writeJournal([
    entry,
    ...Array.from({ length: 105 }, (_, i) => ({
      ...entry,
      id: `complete-${i}`,
      state: "confirmed" as const,
      createdAt: i + 2,
    })),
  ]);
  expect(loadJournal()).toHaveLength(101);
  expect(unresolvedForScope(loadJournal(), 1, account)[0].id).toBe("pending");
  writeJournal([]);
});
