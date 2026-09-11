import { test, expect } from "@playwright/test";
import { mockDeployments } from "../support/deploymentRpc";
import { mockPoolData } from "../support/poolRpc";
import { createFormHash, defaultCreateForm } from "../../src/createForm";

test("matching amounts calculate locally without a wallet or amount-driven RPCs", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page, true);
  let calls = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") calls++;
  });
  const form = {
    ...defaultCreateForm(8453),
    a: "0x0000000000000000000000000000000000000000",
    b: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  };
  await page.goto("/" + createFormHash(form));
  await expect(page.getByTestId("deposit-amount-0")).toBeVisible();
  const before = calls;
  await page.getByTestId("deposit-amount-0").fill("1");
  await expect(
    page.getByRole("heading", { name: "Deposit preview", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("deposit-amount-1")).not.toHaveValue("");
  const paired = await page.getByTestId("deposit-amount-1").inputValue();
  await page.getByTestId("deposit-amount-0").fill("2");
  await expect(page.getByTestId("deposit-amount-1")).not.toHaveValue(paired);
  await expect(page.getByText("Updating deposit preview…")).toHaveCount(0);
  expect(calls).toBe(before);
});
