import { describe, test, expect } from "bun:test";
import { accept, accepted, requireConsent } from "../../src/terms";
import { assertWallet } from "../../src/transactions";
import type { Provider } from "../../src/types";
const account = "0x0000000000000000000000000000000000000001";
describe("transaction consent boundary", () => {
  test("requires explicit per-account acceptance", () => {
    expect(() => requireConsent(account)).toThrow();
    accept(account);
    expect(accepted(account)).toBe(true);
    expect(() =>
      requireConsent("0x0000000000000000000000000000000000000002"),
    ).toThrow();
  });
  test("rejects account or chain changes", async () => {
    accept(account);
    const provider: Provider = {
      request: async ({ method }) =>
        method === "eth_accounts" ? [account] : "0x1",
    };
    await assertWallet(provider, account, 1);
    await expect(assertWallet(provider, account, 2)).rejects.toThrow("network");
    await expect(
      assertWallet(provider, "0x0000000000000000000000000000000000000002", 1),
    ).rejects.toThrow("changed");
  });
});

test("the transaction entrypoint makes no wallet or RPC request before acceptance", async () => {
  const { executeTransaction } = await import("../../src/transactions");
  let calls = 0;
  const provider: Provider = {
    request: async () => {
      calls++;
      return null;
    },
  };
  await expect(
    executeTransaction(
      provider,
      "0x0000000000000000000000000000000000000099",
      {
        chainId: 1,
        rpcUrl: "http://127.0.0.1:1",
        core: account,
        manager: account,
        nativeSymbol: "ETH",
      },
      { data: "0x00" },
    ),
  ).rejects.toThrow("Terms of Service");
  expect(calls).toBe(0);
});

test("an account change during gas estimation prevents any transaction request", async () => {
  const { executeTransaction } = await import("../../src/transactions");
  accept(account);
  let current = account;
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      if (body.method === "eth_estimateGas")
        current = "0x0000000000000000000000000000000000000002";
      const values: Record<string, string> = {
        eth_chainId: "0x1",
        eth_call: "0x",
        eth_estimateGas: "0x5208",
      };
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: values[body.method],
      });
    },
  });
  const provider: Provider = {
    request: async ({ method }) => {
      requests.push(method);
      return method === "eth_accounts" ? [current] : "0x1";
    },
  };
  try {
    await expect(
      executeTransaction(
        provider,
        account,
        {
          chainId: 1,
          rpcUrl: server.url.toString(),
          core: account,
          manager: account,
          nativeSymbol: "ETH",
        },
        { data: "0x00" },
      ),
    ).rejects.toThrow("account changed");
    expect(requests).not.toContain("eth_sendTransaction");
    expect(requests.filter((method) => method === "eth_accounts")).toHaveLength(
      2,
    );
  } finally {
    server.stop(true);
  }
});
