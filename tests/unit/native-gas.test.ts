import { expect, test } from "bun:test";
import {
  availableAfterReserve,
  paddedGas,
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
test("gas padding rounds upward using exact integers", () => {
  expect(paddedGas(21000n)).toBe(25200n);
  expect(paddedGas(1n)).toBe(2n);
  expect(paddedGas(9007199254740993n)).toBe(10808639105689192n);
});
test("legacy-fee networks use the configured RPC gas price", async () => {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();
      const result =
        body.method === "eth_getBlockByNumber"
          ? { ...(gasRpcReply(body.method) as object), baseFeePerGas: null }
          : gasRpcReply(body.method);
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  try {
    expect(
      await nativeFeeCeiling({ ...DEFAULT_SETTINGS, rpcUrl: server.url.href }),
    ).toBe(1000000000n);
  } finally {
    server.stop(true);
  }
});
