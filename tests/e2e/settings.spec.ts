import { test, expect } from "@playwright/test";

test("invalid saved settings recover and RPC replacement survives reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("settings-seeded")) {
      localStorage.setItem(
        "freelp:settings",
        JSON.stringify({ chainId: {}, nativeSymbol: {} }),
      );
      sessionStorage.setItem("settings-seeded", "true");
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const rpcUrl = "http://127.0.0.1:18545/settings-test";
  let unavailable = true;
  await page.route(rpcUrl, async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: unavailable
        ? {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32000, message: "RPC unavailable" },
          }
        : { jsonrpc: "2.0", id: body.id, result: "0x7a69" },
    });
  });
  await page.goto("/#/settings");
  await expect(page.getByLabel("Chain ID")).toHaveValue("1");
  await page.getByLabel("RPC URL").fill(rpcUrl);
  await page.getByRole("button", { name: "Test RPC", exact: true }).click();
  await expect(page.locator(".status")).toContainText("RPC unavailable");
  unavailable = false;
  await page.getByRole("button", { name: "Test RPC", exact: true }).click();
  await expect(page.locator(".status")).toContainText(
    "RPC reports chain 31337",
  );
  await page.getByLabel("Chain ID").fill("31337");
  await page.getByRole("button", { name: "Test RPC", exact: true }).click();
  await expect(page.locator(".status")).toContainText(
    "Connected to chain 31337",
  );
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("RPC URL")).toHaveValue(rpcUrl);
  await expect(page.getByLabel("Chain ID")).toHaveValue("31337");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("freelp:settings")!),
  );
  await page
    .getByRole("textbox", { name: "Configuration JSON" })
    .fill(JSON.stringify({ ...saved, nativeSymbol: {} }));
  await page
    .getByRole("button", { name: "Import settings", exact: true })
    .click();
  await expect(page.locator(".status")).toContainText(
    "Invalid RPC URL or native token symbol",
  );
  await expect(page.getByLabel("Native token symbol")).toHaveValue("ETH");
  expect(errors).toEqual([]);
});

test("network RPC settings remain independent and bundled currencies follow the selected chain", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.getByLabel("Network configuration").selectOption("8453");
  await page.getByLabel("RPC URL").fill("http://127.0.0.1:18545/base");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.getByLabel("Active network").selectOption("42161");
  await expect(page.getByLabel("RPC URL")).toHaveValue(
    "https://arb1.arbitrum.io/rpc",
  );
  await page.getByLabel("Active network").selectOption("8453");
  await page.reload();
  await expect(page.getByLabel("RPC URL")).toHaveValue(
    "http://127.0.0.1:18545/base",
  );
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Select first token" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /USDC/ }).click();
  await expect(page.getByLabel("Token 0 address")).toHaveValue(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );
  await page.getByRole("button", { name: "Select second token" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /ETH Ether/ })
    .click();
  await expect(page.getByLabel("Token 0 address")).toHaveValue(
    "0x0000000000000000000000000000000000000000",
  );
  await expect(page.getByLabel("Token 1 address")).toHaveValue(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );
});

test("Robinhood defaults include USDG and tokenized assets without wrapping ETH", async ({
  page,
}) => {
  await page.goto("/#/create");
  await page.getByLabel("Active network").selectOption("4663");
  await page.getByRole("button", { name: "Select first token" }).click();
  const dialog = page.getByRole("dialog");
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

test("all supported networks are selectable and custom networks persist without home deployment shortcuts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Deploy", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("#main-content a[href='#/deploy']")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Set up positions", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Active network").locator("option")).toHaveCount(
    11,
  );
  await expect(page.getByLabel("Active network")).not.toContainText(
    /Sepolia|Testnet/,
  );
  await page.getByLabel("Active network").selectOption("56");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Select first token" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /BNB BNB/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /USDC/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close token selector" }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Add network", exact: true }).click();
  await page
    .getByLabel("Network name", { exact: true })
    .fill("My local network");
  await page.getByLabel("Chain ID").fill("31337");
  await page.getByLabel("RPC URL").fill("http://127.0.0.1:18545");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByLabel("Active network").locator("option:checked"),
  ).toHaveText("My local network");
  await expect(page.getByLabel("Position manager address")).toHaveValue(
    "0x775A601a3aF4Ccb4a79FF01FAFB455F0Af8fdaC0",
  );
});

test("old testnet presets are retired while custom RPC settings survive", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const contracts = {
      core: "0x00000000000014aA86C5d3c41765bb24e11bd701",
      manager: "0x775A601a3aF4Ccb4a79FF01FAFB455F0Af8fdaC0",
      quoteDataFetcher: "0x5a3F0F1dA4Ac0c4b937d5685f330704c8e8303f1",
      coreDataFetcher: "0xF68F25CA6C817733b7B15a42191AE72A34d56a2B",
      tokenDataFetcher: "0x305Cf9A34dCb265522780D1D64544d3f7C450407",
      nativeSymbol: "ETH",
    };
    const retired = {
      ...contracts,
      chainId: 84532,
      name: "Base Sepolia",
      rpcUrl: "https://sepolia.base.org",
    };
    const custom = {
      ...contracts,
      chainId: 31337,
      name: "Local chain",
      rpcUrl: "http://127.0.0.1:18545",
    };
    localStorage.setItem("freelp:networks", JSON.stringify([retired, custom]));
    localStorage.setItem("freelp:settings", JSON.stringify(retired));
  });
  await page.goto("/#/settings");
  await expect(page.getByLabel("Active network")).toHaveValue("1");
  await expect(page.getByLabel("Active network")).not.toContainText("Sepolia");
  await page.getByLabel("Active network").selectOption("31337");
  await expect(page.getByLabel("RPC URL")).toHaveValue(
    "http://127.0.0.1:18545",
  );
});
