import { rpcEndpoint } from "../../src/chains";
import { mockPoolData } from "../support/poolRpc";
import { mockDeployments } from "../support/deploymentRpc";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";
import { NETWORKS } from "../../src/networks";
import fetcher from "../../artifacts/FreeLPDataFetcher.json" with { type: "json" };

test("picker batches balances only on the selected network, caches reads, and supports keyboard selection", async ({
  page,
}) => {
  const calls = new Map<number, number>();
  for (const network of NETWORKS)
    await page.route(
      (url) =>
        url.href.replace(/\/$/, "") === rpcEndpoint(network).replace(/\/$/, ""),
      async (route) => {
        const body = route.request().postDataJSON();
        if (
          body.method !== "eth_call" ||
          decodeFunctionData({ abi: fetcher.abi, data: body.params[0].data })
            .functionName !== "getNonzeroBalancesAndAllowances"
        )
          return route.fallback();
        expect(body.method).toBe("eth_call");
        expect(
          decodeFunctionData({ abi: fetcher.abi, data: body.params[0].data })
            .functionName,
        ).toBe("getNonzeroBalancesAndAllowances");
        calls.set(network.chainId, (calls.get(network.chainId) ?? 0) + 1);
        await route.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            result: encodeFunctionResult({
              abi: fetcher.abi,
              functionName: "getNonzeroBalancesAndAllowances",
              result: [
                [{ token: zeroAddress, amount: 12500000000000000000n }],
                [],
              ],
            }),
          },
        });
      },
    );
  await page.addInitScript(() => {
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "balance-wallet", name: "Balance wallet" },
            provider: {
              request: async ({ method }: { method: string }) =>
                method === "eth_chainId"
                  ? "0x1"
                  : ["0x1111111111111111111111111111111111111111"],
            },
          },
        }),
      ),
    );
  });
  await mockDeployments(page);
  await mockPoolData(page);
  await page.goto("/#/create");
  await page.getByRole("button", { name: "Connect Balance wallet" }).click();
  await page.getByRole("button", { name: "Select first token" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator(".token-row-balance strong", { hasText: "12.5" }),
  ).toHaveCount(1);
  await expect(
    dialog.getByRole("heading", { name: /Your tokens|Other tokens/ }),
  ).toHaveCount(0);
  expect(calls.size).toBe(1);
  expect(calls.has(1)).toBe(true);
  await expect(page.locator(".currency-mark")).toHaveCount(0);
  expect([...calls.values()]).toEqual([1]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("balances-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: test.info().outputPath("balances-mobile.png"),
  });
  await dialog.getByRole("button", { name: "Close token selector" }).click();
  await page.getByRole("button", { name: "Select first token" }).click();
  const search = dialog.getByLabel("Search tokens or paste an address");
  await expect(search).toBeFocused();
  await search.fill("Ethereum");
  await search.press("ArrowDown");
  await expect(dialog.locator(".token-option").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Select second token" }).click();
  await search.fill("USDC");
  await dialog.locator(".token-option").first().click();
  await expect(page.locator(".balance-actions").first()).toContainText(
    "12.5 ETH",
  );
  for (const [percent, amount] of [
    [25, "3.125"],
    [50, "6.25"],
    [100, "12.5"],
  ] as const) {
    await page
      .locator(".balance-actions")
      .first()
      .getByRole("button", { name: `${percent}%`, exact: true })
      .click();
    await expect(page.getByTestId("deposit-amount-0")).toHaveValue(amount);
  }
  expect([...calls.values()]).toEqual([1]);
});
