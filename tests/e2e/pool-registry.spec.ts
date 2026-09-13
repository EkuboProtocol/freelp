import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { zeroAddress, type Hex } from "viem";
import { encodeEvmConcentratedPoolConfig, type EvmPoolKey } from "@ekubo/sdk";
import { mockDeployments } from "../support/deploymentRpc";
import { mockPoolData } from "../support/poolRpc";
import { BASE_PAIR, fixturePools, mockRegistry } from "../support/registryRpc";
import { readCreateForm } from "../../src/createForm";
import { exactFeeFromPercent } from "../../src/fee";
import { DEFAULT_POOL_KEY_INDEX } from "../../src/deployments";
const url = `/#/create?chain=8453&a=${BASE_PAIR.token0}&b=${BASE_PAIR.token1}`;

test("token selection discovers real pools and preserves exact selected configuration", async ({
  page,
}) => {
  await page.route(
    (url) => url.protocol === "https:",
    (route) => route.abort(),
  );
  await mockDeployments(page);
  await mockPoolData(page, true);
  await mockRegistry(page, fixturePools());
  let reads = 0;
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const body = request.postDataJSON();
    if (
      body.method === "eth_call" &&
      body.params[0].to?.toLowerCase() === DEFAULT_POOL_KEY_INDEX.toLowerCase()
    ) {
      reads++;
      expect(body.params[1]).toBe("0x64");
    }
  });
  await page.goto(url);
  await expect(page.locator(".registered-pool-card")).toHaveCount(2);
  await expect(
    page.getByText("Preset configuration", { exact: true }),
  ).toHaveCount(0);
  const selected = page
    .locator(".registered-pool-card")
    .filter({ hasText: "0.05%" });
  await selected.click();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  const form = readCreateForm(new URL(page.url()).hash, 1);
  expect(form.exactFee).toBe(exactFeeFromPercent("0.05"));
  expect(form.range.spacing).toBe(1000);
  expect(form.extension).toBe(zeroAddress);
  const before = reads;
  await page.getByTestId("deposit-amount-0").fill("0.1");
  await expect(page.getByTestId("deposit-amount-1")).not.toHaveValue("");
  expect(reads).toBe(before);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: test.info().outputPath(`registered-pools-${width}.png`),
      fullPage: true,
    });
  }
});

test("registered pools remain browsable before this manager is deployed", async ({
  page,
}) => {
  await page.route(
    (url) => url.protocol === "https:",
    (route) => route.abort(),
  );
  await mockDeployments(page, "FreeLP");
  await mockPoolData(page, true);
  await mockRegistry(page, fixturePools());
  await page.goto(url);
  await expect(page.locator(".registered-pool-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Deploy contracts to create positions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create position", exact: true }),
  ).toHaveCount(0);
});

test("pair pagination excludes unrelated pools and exposes Load more until complete", async ({
  page,
}) => {
  const config = encodeEvmConcentratedPoolConfig({
    fee: 0n,
    tickSpacing: 100,
    extension: zeroAddress,
  });
  const others = Array.from(
    { length: 16 },
    (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}` as Hex,
  );
  const keys: EvmPoolKey[] = [
    ...others.map((token1) => ({ token0: zeroAddress, token1, config })),
    ...others.map((token0) => ({ token0, token1: BASE_PAIR.token1, config })),
    ...Array.from({ length: 17 }, (_, fee) => ({
      ...BASE_PAIR,
      config: encodeEvmConcentratedPoolConfig({
        fee: BigInt(fee),
        tickSpacing: 100,
        extension: zeroAddress,
      }),
    })),
  ];
  await page.route(
    (url) => url.protocol === "https:",
    (route) => route.abort(),
  );
  await mockDeployments(page);
  await mockPoolData(page, true);
  await mockRegistry(page, keys);
  await page.goto(url);
  await expect(page.locator(".registered-pool-card")).toHaveCount(16);
  await expect(page.getByText(/Loaded 16 of 17/)).toBeVisible();
  await page
    .getByRole("button", { name: "Load more registered pools" })
    .click();
  await expect(page.locator(".registered-pool-card")).toHaveCount(17);
  await expect(page.getByText(/Loaded 17 of 17/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load more registered pools" }),
  ).toHaveCount(0);
});
