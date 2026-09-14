import { expect, test } from "bun:test";
import {
  availableAfterReserve,
  estimateNativeReserve,
  PROVISIONAL_CALL_GAS,
  nativeFeeCeiling,
} from "../../src/nativeGas";
import { DEFAULT_SETTINGS } from "../../src/config";
import { gasRpcReply } from "../support/gasRpc";

test("native spend cap preserves a positive reserve without negative balances", () => {
  expect(availableAfterReserve(1000000000000000000n, 360000000000000n)).toBe(
    999640000000000000n,
  );
  expect(availableAfterReserve(10n, 10n)).toBe(0n);
  expect(availableAfterReserve(1n, 10n)).toBe(0n);
  expect(() => availableAfterReserve(1n, 0n)).toThrow();
});
test("legacy-fee networks use the configured RPC gas price", async () => {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();
      expect(["eth_simulateV1", "eth_estimateGas", "eth_call"]).not.toContain(
        body.method,
      );
      const result =
        body.method === "eth_getBlockByNumber"
          ? { ...(gasRpcReply(body.method) as object), baseFeePerGas: null }
          : body.method === "eth_chainId"
            ? "0x1"
            : gasRpcReply(body.method);
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  try {
    expect(
      await nativeFeeCeiling({ ...DEFAULT_SETTINGS, rpcUrl: server.url.href }),
    ).toBe(1000000000n);
    expect(
      await estimateNativeReserve(
        { ...DEFAULT_SETTINGS, rpcUrl: server.url.href },
        [{ data: "0x" }, { data: "0x" }],
      ),
    ).toBe(PROVISIONAL_CALL_GAS * 2n * 1000000000n);
  } finally {
    server.stop(true);
  }
});
