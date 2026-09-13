import { test, expect } from "@playwright/test";
import { mockDeployments } from "../support/deploymentRpc";
import { decodeFunctionData, encodeFunctionResult, erc20Abi } from "viem";

for (const missing of [
  "Core",
  "PoolKeyIndex",
  "FreeLPMetadataRenderer",
  "FreeLP",
  "FreeLPDataFetcher",
] as const) {
  test(`creation requires deployed ${missing} and opens deployment on the selected chain`, async ({
    page,
  }) => {
    await mockDeployments(page, missing);
    await page.goto("/#/create?chain=8453");
    await expect(page.getByRole("alert")).toContainText(missing);
    await expect(
      page.getByRole("button", { name: "Select first token" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create position", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Go to Deploy" }).click();
    await expect(page.getByLabel("Deployment network")).toHaveValue("8453");
  });
}

test("verified runtime code enables a chain-scoped form without fabricated pool cards", async ({
  page,
}) => {
  await mockDeployments(page);
  await page.goto("/#/create");
  await expect(
    page.getByRole("button", { name: "Select first token" }),
  ).toBeEnabled();
  await expect(page.locator(".pool-options button")).toHaveCount(0);
  await expect(
    page.getByText(
      "Select two tokens to discover registered pools for the pair.",
    ),
  ).toBeVisible();
  await expect(page.locator(".pool-options")).toBeVisible();
  await expect(
    page.getByLabel("Pool fee (%)", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByText("Token metadata fallback", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "Advanced", exact: true }).click();
  await expect(page.getByLabel("Extension address")).toBeVisible();
  await expect(page.locator(".tick-spacing-control")).toBeVisible();
  await page.getByRole("button", { name: "Select first token" }).click();
  await expect(
    page.getByRole("dialog").locator(".token-network").first(),
  ).toHaveText("Ethereum");
  await expect(page.locator(".currency-mark")).toHaveCount(0);
  await page.getByRole("button", { name: "Close token selector" }).click();
  await page.getByLabel("Network", { exact: true }).selectOption("8453");
  await page.getByRole("button", { name: "Select first token" }).click();
  await expect(
    page.getByRole("dialog").locator(".token-network").first(),
  ).toHaveText("Base");
  await expect(page.getByRole("dialog")).not.toContainText("Ethereum");
});

for (const missing of ["symbol", "name", "decimals"] as const) {
  test(`imports require on-chain ${missing} on the selected network`, async ({
    page,
  }) => {
    let failed = true;
    const urls: string[] = [];
    await page.route("https://**", async (route) => {
      urls.push(route.request().url());
      const body = route.request().postDataJSON();
      if (body.method === "eth_getCode")
        return route.fulfill({
          json: { jsonrpc: "2.0", id: body.id, result: "0x6000" },
        });
      const { functionName } = decodeFunctionData({
        abi: erc20Abi,
        data: body.params[0].data,
      });
      if (failed && functionName === missing)
        return route.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32000, message: "Missing token metadata" },
          },
        });
      const result =
        functionName === "decimals"
          ? 6
          : functionName === "name"
            ? "Test Coin"
            : "TST";
      await route.fulfill({
        json: {
          jsonrpc: "2.0",
          id: body.id,
          result: encodeFunctionResult({
            abi: erc20Abi,
            functionName: functionName as "symbol",
            result: result as string,
          }),
        },
      });
    });
    await mockDeployments(page);
    await page.goto("/#/create?chain=8453");
    await page.getByRole("button", { name: "Select first token" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Search tokens or paste an address")
      .fill("0x1111111111111111111111111111111111111111");
    await dialog.getByRole("button", { name: "Read token on Base" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Import token", exact: true }),
    ).toHaveCount(0);
    failed = false;
    await dialog.getByRole("button", { name: "Read token on Base" }).click();
    await dialog
      .getByRole("button", { name: "Import token", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const tokens = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("freelp:tokens:8453")!),
    );
    expect(
      tokens.find((token: { symbol: string }) => token.symbol === "TST"),
    ).toMatchObject({ name: "Test Coin", decimals: 6 });
    expect(
      urls.every((url) => url.startsWith("https://mainnet.base.org")),
    ).toBe(true);
  });
}
