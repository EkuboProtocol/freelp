import { test, expect } from "@playwright/test";
import { decodeFunctionData, toFunctionSelector } from "viem";
import { mockDeployments } from "../support/deploymentRpc";
import { mockPoolData } from "../support/poolRpc";
import { EVM_QUOTE_DATE_FETCHER_V3_ABI as poolAbi } from "../../src/abis/quoteDataFetcher";
import { priceToTick } from "../../src/prices";
const pair =
  "chain=8453&a=0x0000000000000000000000000000000000000000&b=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
test("pool key changes make one automatic pool read; invalid amounts make no RPC reads", async ({
  page,
}) => {
  const configs: string[] = [];
  const requests: string[] = [];
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page);
  page.on("request", (request) => {
    if (!request.url().startsWith("https://")) return;
    const body = request.postDataJSON();
    requests.push(body.method);
    if (
      body.method === "eth_call" &&
      body.params[0].data.startsWith(toFunctionSelector(poolAbi[0]))
    ) {
      const decoded = decodeFunctionData({
        abi: poolAbi,
        data: body.params[0].data,
      });
      expect(decoded.args[0]).toHaveLength(1);
      configs.push(decoded.args[0][0].config);
    }
  });
  await page.goto(`/#/create?${pair}&price0=2000&price1=3000&price2=2500`);
  await expect(page.getByLabel("Lower price", { exact: true })).toBeVisible();
  expect(configs).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Find pools on chain" }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".pool-picker")
      .getByRole("group", { name: "Price range", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".pool-options button")
    .filter({ hasText: "0.05%" })
    .click();
  await expect.poll(() => configs.length).toBe(2);
  await expect(page.getByLabel("Lower price", { exact: true })).toBeVisible();
  expect(configs[1]).not.toBe(configs[0]);
  const count = requests.length;
  await page.getByTestId("deposit-amount-0").fill("nonsense");
  await expect(page.getByRole("alert")).toContainText(
    "Enter a nonnegative decimal amount",
  );
  expect(requests).toHaveLength(count);
  await page.getByText("Advanced pool settings", { exact: true }).click();
  await page
    .getByLabel("Extension address")
    .fill("0x1111111111111111111111111111111111111111");
  await expect.poll(() => configs.length).toBe(3);
});
test("URL values display snapped values without replacing the original URL", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page);
  const hash = `#/create?${pair}&spacing=777.4&price0=2345.6789&price1=3456.789&price2=2500&center=31&amplification=99`;
  await page.goto("/" + hash);
  const lower = page.getByLabel("Lower price", { exact: true });
  await expect(lower).toBeVisible();
  expect(new URL(page.url()).hash).toBe(hash);
  const value = await lower.inputValue();
  expect(value).not.toBe("2345.6789");
  expect(Math.abs(priceToTick(value, 18, 6, 777, "round") % 777)).toBe(0);
  await expect(page.locator(".snapped-value:visible").first()).toBeVisible();
  await lower.fill("2456.789");
  await lower.blur();
  expect(await lower.inputValue()).not.toBe("2456.789");
  expect(new URL(page.url()).hash).toContain("price0=2456.789");
  await page.getByText("Advanced pool settings", { exact: true }).click();
  await page.getByLabel("Pool type", { exact: true }).selectOption("stable");
  await expect(page.getByLabel("Amplification exponent")).toHaveValue("26");
  await expect(page.getByLabel("Center tick (multiple of 16)")).toHaveValue(
    "32",
  );
});
test("initialized pools hide initial price and show range controls outside pool selection", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page, true);
  await page.goto(`/#/create?${pair}`);
  await expect(
    page.getByRole("group", { name: "Price range", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Initial price (new pools only)")).toHaveCount(
    0,
  );
  await expect(page.locator(".pool-picker .liquidity-chart")).toHaveCount(0);
});
