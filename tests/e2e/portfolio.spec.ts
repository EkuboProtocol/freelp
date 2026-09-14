import { rpcEndpoint } from "../../src/chains";
import { test, expect } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";
import { NETWORKS } from "../../src/networks";
import snapshot from "../../artifacts/FreeLPDataFetcher.json" with { type: "json" };

test("all networks load independently with exactly one portfolio RPC each", async ({
  page,
}) => {
  const calls = new Map<number, string[]>();
  for (const network of NETWORKS)
    await page.route(
      (url) =>
        url.href.replace(/\/$/, "") === rpcEndpoint(network).replace(/\/$/, ""),
      async (route) => {
        const body = route.request().postDataJSON();
        calls.set(network.chainId, [
          ...(calls.get(network.chainId) ?? []),
          body.method,
        ]);
        expect(body.method).toBe("eth_call");
        expect(
          decodeFunctionData({ abi: snapshot.abi, data: body.params[0].data })
            .functionName,
        ).toBe("ownedPositions");
        const items = [1, 8453].includes(network.chainId)
          ? [
              {
                id: 1n,
                descriptor: {
                  poolKey: {
                    token0: zeroAddress,
                    token1:
                      network.chainId === 1
                        ? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
                        : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    config: "0x" + "00".repeat(32),
                  },
                  tickLower: network.chainId === 1 ? -100 : 200,
                  tickUpper: network.chainId === 1 ? 100 : 300,
                },
                amounts: {
                  liquidity: 1n,
                  principal0: 10n ** 18n,
                  principal1: 2000_000000n,
                  fees0: 10n ** 16n,
                  fees1: 5_000000n,
                },
                sqrtRatio: 1n << 128n,
                metadata: "data:application/json;base64,e30=",
              },
            ]
          : [];
        if (network.chainId === 1 && items.length)
          items.push({
            ...items[0],
            id: 2n,
            amounts: { ...items[0].amounts, liquidity: 0n },
          });
        await route.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            result: encodeFunctionResult({
              abi: snapshot.abi,
              functionName: "ownedPositions",
              result: [BigInt(network.chainId), true, items],
            }),
          },
        });
      },
    );
  await page.addInitScript(() => {
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "portfolio-wallet", name: "Portfolio wallet" },
            provider: {
              request: async ({ method }: { method: string }) =>
                method === "eth_chainId"
                  ? "0x1"
                  : ["0x1111111111111111111111111111111111111111"],
            },
          },
        }),
      );
    window.addEventListener("eip6963:requestProvider", announce);
  });
  await page.goto("/");
  await expect(page.getByLabel("Active network")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(page.locator(".portfolio-position")).toHaveCount(3);
  await expect(page.locator(".current-price strong")).toHaveText([
    "1000000000000",
    "1000000000000",
    "1000000000000",
  ]);
  await expect(
    page.getByRole("button", { name: "Refresh positions", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".portfolio-position")).toContainText([
    "Uncollected fees: 0.01 ETH / 5 USDC",
    "Uncollected fees: 0.01 ETH / 5 USDC",
    "Uncollected fees: 0.01 ETH / 5 USDC",
  ]);
  await expect(page.locator(".portfolio-position")).toHaveCount(3);
  await expect(page.locator(".position-status.active")).toHaveText("In range");
  await expect(page.locator(".position-status.inactive")).toHaveText(
    "Out of range",
  );
  await expect(page.locator(".position-status.closed")).toHaveText("Closed");
  expect(calls.size).toBe(NETWORKS.length);
  for (const requests of calls.values()) expect(requests).toEqual(["eth_call"]);
  await page.screenshot({
    path: test.info().outputPath("portfolio-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: test.info().outputPath("portfolio-mobile.png"),
    fullPage: true,
  });
  // Navigation must not depend on an RPC response or a focus-triggered refresh.
  await page.route("https://**", (route) => route.abort());
  for (const exit of ["back", "navigation", "all positions"]) {
    await page
      .locator(".portfolio-position")
      .first()
      .getByRole("link", { name: "Manage position #1", exact: true })
      .click();
    await expect(
      page.getByLabel("Manage position", { exact: true }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    if (exit === "back") await page.goBack();
    else if (exit === "navigation")
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Positions", exact: true })
        .click();
    else
      await page
        .getByRole("link", { name: "All positions", exact: true })
        .click();
    await expect(page.locator(".portfolio-positions")).toBeVisible();
    await expect(
      page.getByLabel("Manage position", { exact: true }),
    ).toHaveCount(0);
  }
});
test("RPC failure never claims an empty portfolio and a targeted retry recovers", async ({
  page,
}) => {
  let healthy = false;
  await page.addInitScript(() => {
    localStorage.setItem(
      "freelp:chainPreferences",
      JSON.stringify({ enabledChainIds: [1], rpcOverrides: {} }),
    );
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "portfolio-test", name: "Test wallet" },
            provider: {
              request: async () => [
                "0x1111111111111111111111111111111111111111",
              ],
            },
          },
        }),
      ),
    );
  });
  await page.route(
    (url) => url.protocol === "https:",
    async (route) => {
      if (!healthy) return route.abort();
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          jsonrpc: "2.0",
          id: body.id,
          result: encodeFunctionResult({
            abi: snapshot.abi,
            functionName: "ownedPositions",
            result: [1n, true, []],
          }),
        },
      });
    },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(
    page.getByText(
      "Positions could not be checked on all enabled networks. Retry the unavailable networks below.",
    ),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText("No FreeLP positions found on the enabled networks."),
  ).toHaveCount(0);
  healthy = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByText("No FreeLP positions found on the enabled networks."),
  ).toBeVisible();
});
