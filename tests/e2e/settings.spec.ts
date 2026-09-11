import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEFAULT_CONTRACTS } from "../../src/deployments";

test("RPC-only add dialog detects networks, rejects failures and persists fixed contracts", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "freelp:settings",
      JSON.stringify({ chainId: {}, nativeSymbol: {} }),
    ),
  );
  let available = false;
  const url = "http://127.0.0.1:18545/settings-test";
  await page.route(url, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.method).toBe("eth_chainId");
    await route.fulfill({
      json: {
        jsonrpc: "2.0",
        id: body.id,
        ...(available
          ? { result: "0x7a69" }
          : { error: { code: -32000, message: "RPC unavailable" } }),
      },
    });
  });
  await page.goto("/#/settings");
  await expect(page.locator(".network-row")).toHaveCount(11);
  await expect(
    page.getByRole("button", {
      name: /Import settings|Export settings|Verify contracts/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add network", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("RPC URL")).toBeFocused();
  await expect(dialog.locator("input")).toHaveCount(1);
  await dialog.getByLabel("RPC URL").fill(url);
  await dialog.getByRole("button", { name: "Save network" }).click();
  await expect(dialog.getByRole("alert")).toContainText("RPC unavailable");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  available = true;
  await dialog.getByRole("button", { name: "Save network" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".network-row").filter({ hasText: "Chain 31337" }),
  ).toContainText(url);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("freelp:settings")!),
  );
  expect(saved).toMatchObject({
    ...DEFAULT_CONTRACTS,
    chainId: 31337,
    rpcUrl: url,
  });
  await page.reload();
  await expect(
    page.locator(".network-row").filter({ hasText: "Chain 31337" }),
  ).toContainText(url);
});

test("editing an RPC checks chain identity and preserves other networks", async ({
  page,
}) => {
  const url = "http://127.0.0.1:18545/base";
  let chain = "0x1";
  await page.route(url, async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: { jsonrpc: "2.0", id: body.id, result: chain },
    });
  });
  await page.goto("/#/settings");
  await page
    .getByRole("button", { name: "Edit Base RPC", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("RPC URL").fill(url);
  await dialog.getByRole("button", { name: "Save network" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Expected chain 8453");
  chain = "0x2105";
  await dialog.getByRole("button", { name: "Save network" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".network-row")
      .filter({
        has: page.getByRole("button", { name: "Edit Base RPC", exact: true }),
      }),
  ).toContainText(url);
  await expect(
    page.locator(".network-row").filter({ hasText: "Arbitrum" }),
  ).toContainText("https://arb1.arbitrum.io/rpc");
});

test("positions expose creation while header and app omit removed controls and IPFS", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator("header").getByRole("link", { name: "Create", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Create position", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select first token" }),
  ).toBeVisible();
  await page.goto("/#/build");
  await expect(page.locator("body")).not.toContainText(/IPFS|IPNS/);
  await page.goto("/#/deploy");
  await expect(
    page.getByRole("button", { name: /In use|Use this address/ }),
  ).toHaveCount(0);
});
test("Robinhood defaults include USDG and tokenized assets without wrapping ETH", async ({
  page,
}) => {
  await page.goto("/#/create");
  await page.getByRole("button", { name: "Select first token" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Search tokens or paste an address")
    .fill("Robinhood");
  await expect(dialog.getByRole("button", { name: /WETH/ })).toHaveCount(0);
  await dialog.getByLabel("Search tokens or paste an address").fill("NVDA");
  await expect(dialog.getByRole("button", { name: /NVDA/ })).toBeVisible();
  await dialog.getByLabel("Search tokens or paste an address").fill("USDG");
  await dialog.getByRole("button", { name: /USDG/ }).click();
  await expect(page.getByLabel("Token 0 address")).toHaveValue(
    "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  );
  await page.getByRole("button", { name: "Select second token" }).click();
  await dialog.getByRole("button", { name: /ETH/ }).click();
  await expect(page.getByLabel("Token 0 address")).toHaveValue(
    "0x0000000000000000000000000000000000000000",
  );
});
