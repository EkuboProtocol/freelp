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
