import { mockDeployments } from "../support/deploymentRpc";
import { readCreateForm } from "../../src/createForm";
import {
  chainDefinition,
  DEFAULT_CHAIN_IDS,
  MAINNET_CHAINS,
} from "../../src/chains";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("viem mainnet catalog enables only the chosen 11 by default and persists toggles", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await expect(page.locator(".network-row")).toHaveCount(MAINNET_CHAINS.length);
  await expect(
    page.getByRole("button", { name: "Add network", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Native token symbol")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(11);
  expect(
    await page.evaluate(() => localStorage.getItem("freelp:chainPreferences")),
  ).toBeNull();
  await page.getByLabel("Search networks").fill("43114");
  const avalanche = page.getByRole("checkbox", {
    name: `Enable ${chainDefinition(43114).name}`,
    exact: true,
  });
  await expect(avalanche).not.toBeChecked();
  await avalanche.check();
  let preferences = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("freelp:chainPreferences")!),
  );
  expect(preferences.enabledChainIds).toEqual([...DEFAULT_CHAIN_IDS, 43114]);
  expect(preferences.rpcOverrides).toEqual({});
  const native = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("freelp:tokens:43114")!).filter(
      (token: { address: string }) =>
        token.address === "0x0000000000000000000000000000000000000000",
    ),
  );
  expect(native).toEqual([
    {
      address: "0x0000000000000000000000000000000000000000",
      ...chainDefinition(43114).nativeCurrency,
    },
  ]);
  await page.getByLabel("Search networks").fill("Ethereum");
  await page
    .getByRole("checkbox", { name: "Enable Ethereum", exact: true })
    .uncheck();
  await page.reload();
  await expect(page.locator(".network-row")).toHaveCount(MAINNET_CHAINS.length);
  await expect(
    page.getByRole("checkbox", { name: "Enable Ethereum", exact: true }),
  ).not.toBeChecked();
  preferences = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("freelp:chainPreferences")!),
  );
  expect(preferences.enabledChainIds).not.toContain(1);
  expect(preferences.rpcOverrides).toEqual({});
  await page.getByLabel("Search networks").fill("Sepolia");
  await expect(page.locator(".network-row")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("RPC overrides start empty, verify the catalog chain ID, and reset to viem defaults", async ({
  page,
}) => {
  const url = "http://127.0.0.1:18545/base";
  let chain = "0x1",
    requests = 0;
  await page.route(url, async (route) => {
    const body = route.request().postDataJSON();
    requests++;
    expect(body.method).toBe("eth_chainId");
    await route.fulfill({
      json: { jsonrpc: "2.0", id: body.id, result: chain },
    });
  });
  await page.goto("/#/settings");
  await page
    .getByRole("button", { name: "Edit Base RPC", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    input = dialog.getByLabel("RPC URL override");
  await expect(input).toHaveValue("");
  await expect(input).toHaveAttribute(
    "placeholder",
    chainDefinition(8453).rpcUrls.default.http[0],
  );
  await input.fill(url);
  await dialog.getByRole("button", { name: "Save RPC", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Expected chain 8453");
  chain = "0x2105";
  await dialog.getByRole("button", { name: "Save RPC", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("freelp:chainPreferences")!)
          .rpcOverrides,
    ),
  ).toEqual({ "8453": url });
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Base RPC", exact: true })
    .click();
  await expect(input).toHaveValue(url);
  await dialog
    .getByRole("button", { name: "Use default RPC", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(requests).toBe(2);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("freelp:chainPreferences")!)
          .rpcOverrides,
    ),
  ).toEqual({});
});

test("all chains may be disabled without deployment RPC requests or silent re-enabling", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("https://**", (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto("/#/settings");
  for (let i = 0; i < 11; i++)
    await page.getByRole("checkbox", { checked: true }).first().click();
  await page.reload();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page.goto("/#/deploy");
  await expect(
    page.getByText("Enable a network in Networks to deploy contracts."),
  ).toBeVisible();
  await page.goto("/#/create");
  await expect(
    page.getByText("Enable this network in Networks before using this link."),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("creation is reachable before wallet connection and deployment omits address overrides", async ({
  page,
}) => {
  await mockDeployments(page);
  await page.goto("/");
  await expect(
    page.locator("header").getByRole("link", { name: "Create", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create position", exact: true }).click();
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
  await mockDeployments(page);
  await page.goto("/#/create");
  await page
    .getByLabel("Network", { exact: true })
    .selectOption({ label: "Robinhood Chain" });
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
  await expect
    .poll(() => readCreateForm(new URL(page.url()).hash, 1).a)
    .toBe("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
  await page.getByRole("button", { name: "Select second token" }).click();
  await dialog.getByRole("button", { name: /ETH/ }).click();
  await expect
    .poll(() => readCreateForm(new URL(page.url()).hash, 1).a)
    .toBe("0x0000000000000000000000000000000000000000");
});
