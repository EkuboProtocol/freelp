import { describe, test, expect } from "bun:test";
import { assertWallet } from "../../src/transactions";
import type { Provider } from "../../src/types";
import { gasRpcReply } from "../support/gasRpc";
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

test("an account change before submission prevents any transaction request without simulation", async () => {
  const { executeTransaction } = await import("../../src/transactions");
  let reads = 0;
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      expect(["eth_simulateV1", "eth_estimateGas", "eth_call"]).not.toContain(
        body.method,
      );
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
      return method === "eth_accounts"
        ? [
            ++reads === 1
              ? account
              : "0x0000000000000000000000000000000000000002",
          ]
        : "0x1";
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
          gasRpcReply(body.method) ??
          (body.method === "eth_chainId"
            ? "0x1"
            : body.method === "eth_estimateGas"
              ? "0x5208"
              : "0x"),
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
      if (method === "eth_sendTransaction") {
        expect((params as Record<string, unknown>[])[0]).not.toHaveProperty(
          "gas",
        );
        throw Object.assign(new Error("User declined transaction"), {
          code: 4001,
        });
      }
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
    ).rejects.toThrow("rejected in the wallet");
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
