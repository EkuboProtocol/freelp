import { test, expect, type Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  padHex,
  zeroAddress,
} from "viem";
import snapshot from "../../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import manager from "../../artifacts/FreeLP.json" with { type: "json" };

const owner = "0x1111111111111111111111111111111111111111";
const stranger = "0x2222222222222222222222222222222222222222";
const position = {
  id: 1n,
  descriptor: {
    poolKey: {
      token0: zeroAddress,
      token1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      config: ("0x" + "00".repeat(32)) as `0x${string}`,
    },
    tickLower: -100,
    tickUpper: 100,
  },
  amounts: {
    liquidity: 123456789n,
    principal0: 10n ** 18n,
    principal1: 2000_000000n,
    fees0: 10n ** 16n,
    fees1: 5_000000n,
  },
  sqrtRatio: 1n << 128n,
  metadata: "data:application/json;base64,e30=",
};

/** Mocks chain 1 with one position owned by `owner`; `busy` returns 429s. */
async function mockChain(page: Page, state: { busy: boolean }) {
  const methods: string[] = [];
  await page.route(
    (url) => url.protocol === "https:",
    async (route) => {
      const body = route.request().postDataJSON();
      methods.push(body.method);
      if (state.busy)
        return route.fulfill({
          status: 429,
          json: {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: 429, message: "Too many requests" },
          },
        });
      const reply = (result: unknown) =>
        route.fulfill({ json: { jsonrpc: "2.0", id: body.id, result } });
      if (body.method === "eth_chainId") return reply("0x1");
      if (body.method !== "eth_call") return reply("0x");
      const data = body.params[0].data as `0x${string}`;
      const call = decodeFunctionData({
        abi: [...snapshot.abi, ...manager.abi, ...erc20Abi],
        data,
      });
      if (call.functionName === "ownedPositions") {
        const holder = String(call.args![1]).toLowerCase();
        return reply(
          encodeFunctionResult({
            abi: snapshot.abi,
            functionName: "ownedPositions",
            result: [1n, true, holder === owner ? [position] : []],
          }),
        );
      }
      if (call.functionName === "ownerOf")
        return reply(padHex(owner, { size: 32 }));
      if (call.functionName === "symbol")
        return reply(
          encodeFunctionResult({
            abi: erc20Abi,
            functionName: "symbol",
            result: "USDC",
          }),
        );
      if (call.functionName === "decimals")
        return reply(
          encodeFunctionResult({
            abi: erc20Abi,
            functionName: "decimals",
            result: 6,
          }),
        );
      return reply(padHex("0x0", { size: 32 }));
    },
  );
  return methods;
}

async function installWallet(page: Page, account: string) {
  await page.addInitScript(
    ({ account }) => {
      localStorage.setItem(
        "freelp:chainPreferences",
        JSON.stringify({ enabledChainIds: [1], rpcOverrides: {} }),
      );
      const calls: string[] = [];
      Object.defineProperty(window, "walletCalls", { get: () => calls });
      window.addEventListener("eip6963:requestProvider", () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: { uuid: "lookup", name: "Test wallet" },
              provider: {
                request: async ({ method }: { method: string }) => {
                  calls.push(method);
                  if (method === "eth_chainId") return "0x1";
                  if (method === "eth_sendTransaction")
                    throw Object.assign(new Error("User declined"), {
                      code: 4001,
                    });
                  return [account];
                },
              },
            },
          }),
        ),
      );
    },
    { account },
  );
}

test("a position is viewable by ID without a wallet and stays read-only for non-owners", async ({
  page,
}) => {
  await mockChain(page, { busy: false });
  await installWallet(page, stranger);
  await page.goto("/#/positions/1/1");
  await expect(
    page.getByLabel("Manage position", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Position unavailable")).toHaveCount(0);
  await expect(
    page.getByText("Connect the owning wallet to add, withdraw, or collect."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ETH / USDC" })).toBeVisible();
  await expect(page.getByText("Owner: 0x1111…1111")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Withdraw", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add liquidity to position" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Collect fees" }),
  ).toBeDisabled();

  await page
    .getByRole("button", { name: "Connect Test wallet", exact: true })
    .click();
  await expect(
    page.getByText("This position is owned by another wallet."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Withdraw", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Position unavailable")).toHaveCount(0);

  await page.goto("/#/positions/1/99");
  await expect(
    page.getByRole("heading", { name: "Position not found" }),
  ).toBeVisible();
  await page.goto("/#/positions/8453/1");
  await expect(page.getByText("Enable this network in Networks")).toBeVisible();
});

test("the owner can withdraw while the RPC is busy, and the dialog reviews amounts per token", async ({
  page,
}) => {
  const state = { busy: false };
  const methods = await mockChain(page, state);
  await installWallet(page, owner);
  await page.goto("/#/positions/1/1");
  await page
    .getByRole("button", { name: "Connect Test wallet", exact: true })
    .click();
  // The owner's portfolio load replaces the lookup view; either view must
  // enable actions, so assert on the controls rather than the owner line.
  const withdraw = page.getByRole("button", { name: "Withdraw", exact: true });
  await expect(withdraw).toBeEnabled();
  state.busy = true;
  methods.length = 0;
  await withdraw.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Liquidity", { exact: true })).toHaveCount(0);
  await expect(dialog.locator(".withdrawal-review")).toContainText("1 ETH");
  await expect(dialog.locator(".withdrawal-review")).toContainText("2000 USDC");
  await expect(dialog.getByLabel("Recipient address")).toHaveValue(owner);
  await expect(dialog.getByRole("button", { name: "Advanced" })).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Withdraw liquidity and fees" })
    .click();
  await expect(page.locator("dialog[open] .status[role=status]")).toContainText(
    "rejected in the wallet",
  );
  const walletCalls = await page.evaluate(
    () => (window as unknown as { walletCalls: string[] }).walletCalls,
  );
  expect(walletCalls).toContain("eth_sendTransaction");
  // Every RPC answered 429, so the request reached the wallet with no RPC gate.
  expect(methods.length).toBeGreaterThan(0);
  await expect(page.locator("dialog[open]")).toBeVisible();
});
