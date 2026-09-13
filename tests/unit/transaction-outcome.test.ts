import { expect, test } from "bun:test";
import { executeTransaction } from "../../src/transactions";
import { terminalBatchState } from "../../src/batchOutcome";
import { DEFAULT_SETTINGS } from "../../src/config";
import { gasRpcReply } from "../support/gasRpc";

const account = "0x1111111111111111111111111111111111111111";
const hash = `0x${"12".repeat(32)}`;

function receipt(transactionHash: string) {
  return {
    transactionHash,
    blockHash: `0x${"34".repeat(32)}`,
    blockNumber: "0x1",
    from: account,
    to: account,
    contractAddress: null,
    cumulativeGasUsed: "0x5208",
    effectiveGasPrice: "0x1",
    gasUsed: "0x5208",
    logs: [],
    logsBloom: `0x${"00".repeat(256)}`,
    status: "0x1",
    transactionIndex: "0x0",
    type: "0x2",
  };
}

test("invalid receipts fail without retrying submission or blocking the next explicit request", async () => {
  let wrongReceipt = true;
  let sends = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();
      const values: Record<string, unknown> = {
        eth_chainId: "0x1",
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
      executeTransaction(provider, account, settings, { data: "0x00" }),
    ).rejects.toThrow("confirmation is unknown");
    expect(sends).toBe(1);
    wrongReceipt = false;
    expect(
      (await executeTransaction(provider, account, settings, { data: "0x00" }))
        .status,
    ).toBe("success");
    expect(sends).toBe(2);
  } finally {
    server.stop(true);
  }
});

test("batch state distinguishes pending, verified success, complete revert and partial failure", () => {
  expect(terminalBatchState(100, ["success"])).toBe("unknown");
  expect(terminalBatchState(200, ["success"])).toBe("confirmed");
  expect(terminalBatchState(200, ["success", "reverted"])).toBe("unknown");
  expect(terminalBatchState(500, ["reverted"])).toBe("reverted");
  expect(terminalBatchState(600, ["success", "reverted"])).toBe("partial");
  expect(terminalBatchState(200, [])).toBe("unknown");
});
