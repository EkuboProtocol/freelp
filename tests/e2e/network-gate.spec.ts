import { test, expect, type Page } from "@playwright/test";
import { chainDefinition, MAINNET_CHAINS } from "../../src/chains";
import {
  DEFAULT_MANAGER,
  DEFAULT_POSITION_DATA_FETCHER,
} from "../../src/deployments";
import { mockDeployments } from "../support/deploymentRpc";

function recordMethods(page: Page) {
  const methods: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const body = request.postDataJSON();
    for (const call of Array.isArray(body) ? body : [body])
      methods.push(call.method);
  });
  return methods;
}

test("listing networks makes no code reads and a blocked enable opens the deployment modal", async ({
  page,
}) => {
  const methods = recordMethods(page);
  await mockDeployments(page, "FreeLP");
  await page.goto("/#/networks");
  await expect(page.locator(".network-row")).toHaveCount(MAINNET_CHAINS.length);
  await expect(page.locator(".network-row").first()).toContainText(
    "Not checked",
  );
  expect(methods).toEqual([]);
  await page.getByLabel("Search networks").fill("Ethereum");
  const ethereum = page.getByRole("checkbox", {
    name: "Enable Ethereum",
    exact: true,
  });
  const row = page.locator(".network-row", { hasText: "Ethereum" }).first();
  await ethereum.uncheck();
  expect(methods).toEqual([]);

  await ethereum.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Contracts are not deployed on Ethereum",
    }),
  ).toBeVisible();
  await expect(dialog).not.toContainText("FreeLP:");
  await expect(dialog.getByRole("button", { name: "Retry" })).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Deploy on this network" }),
  ).toHaveAttribute("href", "#/deploy/1");
  await expect(
    page.getByRole("link", { name: /Deploy contracts on/ }),
  ).toHaveCount(0);
  await expect(ethereum).not.toBeChecked();
  expect(methods.filter((method) => method === "eth_chainId")).toHaveLength(1);
  expect(methods.filter((method) => method === "eth_getCode")).toHaveLength(5);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("freelp:chainPreferences")!)
          .enabledChainIds,
    ),
  ).not.toContain(1);
  expect(
    await page.evaluate(() => localStorage.getItem("freelp:verifiedNetworks")),
  ).toBeNull();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText("Needs deployment");

  const url = chainDefinition(1).rpcUrls.default.http[0];
  await page.route(url, (route) => route.abort());
  await ethereum.click();
  await expect(
    dialog.getByRole("heading", { name: "Could not verify Ethereum" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(ethereum).not.toBeChecked();
  await expect(
    dialog.getByRole("link", { name: "Deploy on this network" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.unroute(url);
  await mockDeployments(page);
  await ethereum.click();
  await expect(ethereum).toBeChecked();
  await expect(row).toContainText("Ready");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("freelp:verifiedNetworks")!),
    ),
  ).toEqual({
    1: { manager: DEFAULT_MANAGER, fetcher: DEFAULT_POSITION_DATA_FETCHER },
  });
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("freelp:chainPreferences")!)
          .enabledChainIds,
    ),
  ).toContain(1);

  methods.length = 0;
  await page.reload();
  await page.getByLabel("Search networks").fill("Ethereum");
  await expect(row).toContainText("Ready");
  await expect(ethereum).toBeChecked();
  expect(methods).toEqual([]);
});

test("deploy pages are scoped to a chain and invalid links point back to Networks", async ({
  page,
}) => {
  await mockDeployments(page, undefined, [43114]);
  await page.goto("/#/deploy/8453");
  await expect(
    page.locator("header nav").getByRole("link", { name: "Deploy" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Deploy contracts" }),
  ).toBeVisible();
  await expect(page.locator("p", { hasText: "Network:" })).toContainText(
    "Base (8453) · enabled",
  );
  await expect(
    page.getByText("All contracts are deployed and this network is enabled."),
  ).toBeVisible();
  await expect(page.getByLabel("Deployment network")).toHaveCount(0);

  await page.goto("/#/deploy/43114");
  await expect(page.locator("p", { hasText: "Network:" })).toContainText(
    "Avalanche (43114) · not enabled",
  );
  await expect(
    page.getByText(
      "All contracts are deployed. Now enable this network in Networks.",
    ),
  ).toBeVisible();

  for (const route of ["/#/deploy/987654321987", "/#/deploy/abc"]) {
    await page.goto(route);
    await expect(page.getByRole("alert")).toContainText(
      "does not name a supported network",
    );
  }
  await page.getByRole("link", { name: "Networks" }).last().click();
  await expect(
    page.getByRole("heading", { name: "Networks", exact: true }),
  ).toBeVisible();

  await page.goto("/#/deploy");
  await expect(page).toHaveURL(/#\/deploy\/1$/);
  await expect(page.locator("p", { hasText: "Network:" })).toContainText(
    "Ethereum (1)",
  );
});
