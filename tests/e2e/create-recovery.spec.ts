import { test, expect } from "@playwright/test";
import { mockPoolData } from "../support/poolRpc";
import { mockDeployments } from "../support/deploymentRpc";
import { readCreateForm } from "../../src/createForm";
const pair =
  "chain=8453&a=0x0000000000000000000000000000000000000000&b=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

test("initial price is explicit and sequential typing does not freeze derived bounds", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page);
  await page.goto(`/#/create?${pair}`);
  const price = page.getByLabel("Initial price", { exact: true });
  await expect(price).toHaveValue("");
  await price.pressSequentially("2500");
  expect(readCreateForm(new URL(page.url()).hash, 1).range.prices).toEqual([
    "",
    "",
    "2500",
  ]);
  await page.getByLabel("Minimum price", { exact: true }).fill("2000");
  await page.getByLabel("Maximum price", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Edit exact ticks" }).click();
  await expect(
    page.getByLabel("Minimum tick", { exact: true }),
  ).not.toHaveValue("");
  await page.getByRole("button", { name: "Use prices" }).click();
  await page.getByRole("button", { name: "Full range", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Custom range", exact: true }),
  ).toBeVisible();
});

test("clearing or invalidating the specified amount clears the matching amount", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page, true);
  await page.goto(`/#/create?${pair}`);
  const input = page.getByTestId("deposit-amount-0");
  const output = page.getByTestId("deposit-amount-1");
  await input.fill("0.1");
  await expect(output).not.toHaveValue("");
  await input.fill("");
  await expect(output).toHaveValue("");
  await input.fill("0.2");
  await expect(output).not.toHaveValue("");
  await input.fill("invalid");
  await expect(output).toHaveValue("");
});
