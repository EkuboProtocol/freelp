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
