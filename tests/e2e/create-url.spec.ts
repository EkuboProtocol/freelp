import { mockPoolData } from "../support/poolRpc";
import { mockDeployments } from "../support/deploymentRpc";
import { test, expect } from "@playwright/test";
import {
  createFormHash,
  defaultCreateForm,
  readCreateForm,
} from "../../src/createForm";

test("create links restore all pool parameters and amounts on reload and history navigation", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page);
  const form = {
    ...defaultCreateForm(8453),
    a: "0x0000000000000000000000000000000000000000",
    b: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    kind: "stable" as const,
    extension: "0x1234567890123456789012345678901234567890",
    fee: "0.0123456789",
    exactFee: "123456789123456789",
    amplification: "12",
    center: "-160",
    maxA: "1.25",
    maxB: "2.5",
    specified: 1 as const,
    slippage: 77,
  };
  await page.goto("/" + createFormHash(form));
  await page.getByText("Advanced pool settings", { exact: true }).click();
  await expect(page.getByLabel("Pool type", { exact: true })).toHaveValue(
    "stable",
  );
  await expect(page.getByLabel("Extension address")).toHaveValue(
    form.extension,
  );
  await expect(page.getByLabel("Exact fee (uint64)")).toHaveValue(
    form.exactFee,
  );
  await expect(page.getByLabel("Center tick (multiple of 16)")).toHaveValue(
    "-160",
  );
  await expect(page.getByTestId("deposit-amount-1")).toHaveValue("2.5");
  await expect(
    page.getByLabel("Calculate the matching token amount"),
  ).toHaveCount(0);
  await expect(page.locator(".pool-options")).toBeVisible();
  await page.getByLabel("Amplification exponent").fill("26");
  await expect
    .poll(() => readCreateForm(new URL(page.url()).hash, 1).amplification)
    .toBe("26");
  const saved = page.url();
  await page.reload();
  await page.getByText("Advanced pool settings", { exact: true }).click();
  await expect(page.getByLabel("Amplification exponent")).toHaveValue("26");
  expect(readCreateForm(new URL(page.url()).hash, 1)).toEqual({
    ...form,
    amplification: "26",
  });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.goBack();
  await expect(page.getByTestId("deposit-amount-0")).toHaveValue("1.25");
  expect(page.url()).toBe(saved);
});

test("pool fee editors stay synchronized and deposit amounts follow pool configuration", async ({
  page,
}) => {
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page);
  await page.goto(
    "/#/create?chain=8453&a=0x0000000000000000000000000000000000000000&b=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );
  await page.getByText("Advanced pool settings", { exact: true }).click();
  await expect(page.getByLabel("Slippage (basis points)")).toBeVisible();
  await expect(page.getByLabel("Token 0 address", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Token 1 address", { exact: true })).toHaveCount(
    0,
  );
  const percent = page.getByLabel("Pool fee (%)", { exact: true });
  const exact = page.getByLabel("Exact fee (uint64)");
  await percent.fill("0.3");
  await expect(exact).toHaveValue("55340232221128654");
  await exact.fill("9223372036854775808");
  await expect(percent).toHaveValue("50");
  await percent.fill("0.05");
  await expect(exact).toHaveValue("9223372036854775");
  const amount = page.getByTestId("deposit-amount-0");
  const range = page.getByRole("group", { name: "Price range", exact: true });
  expect(
    await range.evaluate((element) => {
      const amount = document.querySelector(
        '[data-testid="deposit-amount-0"]',
      )!;
      return !!(
        element.compareDocumentPosition(amount) &
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }),
  ).toBe(true);
  await expect(amount).toBeVisible();
});
