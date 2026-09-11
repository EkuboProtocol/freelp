import { test, expect } from "@playwright/test";
import { mockDeployments } from "../support/deploymentRpc";

test("page navigation uses the initial JavaScript bundle", async ({ page }) => {
  await mockDeployments(page);
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your positions", exact: true }),
  ).toBeVisible();
  expect(scripts).toHaveLength(1);
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Terms of Service" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Networks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Networks", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Deploy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deploy contracts" }),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#/create";
  });
  await expect(
    page.getByRole("button", { name: "Select first token" }),
  ).toBeVisible();
  expect(scripts).toHaveLength(1);
});
