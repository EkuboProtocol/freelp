import { describe, test, expect } from "bun:test";
import { assertWallet } from "../../src/transactions";
import type { Provider } from "../../src/types";
const account = "0x0000000000000000000000000000000000000001";
describe("transaction wallet boundary", () => {
  test("rejects account or chain changes", async () => {
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

test("an account change during gas estimation prevents any transaction request", async () => {
  const { executeTransaction } = await import("../../src/transactions");
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

test("a position transaction requests its own network before wallet submission", async () => {
  const { executeTransaction } = await import("../../src/transactions");
  let chain = "0x2105";
  const methods: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result:
          body.method === "eth_chainId"
            ? "0x1"
            : body.method === "eth_estimateGas"
              ? "0x5208"
              : "0x",
      });
    },
  });
  const provider: Provider = {
    request: async ({ method, params }) => {
      methods.push(method);
      if (method === "wallet_switchEthereumChain") {
        expect(params).toEqual([{ chainId: "0x1" }]);
        chain = "0x1";
        return null;
      }
      if (method === "eth_accounts") return [account];
      if (method === "eth_sendTransaction")
        throw new Error("User declined transaction");
      return chain;
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
    ).rejects.toThrow("User declined transaction");
    expect(
      methods.filter((m) => m === "wallet_switchEthereumChain"),
    ).toHaveLength(1);
    expect(methods.indexOf("wallet_switchEthereumChain")).toBeLessThan(
      methods.indexOf("eth_sendTransaction"),
    );
  } finally {
    server.stop(true);
  }
});
