import { test, expect } from "@playwright/test";
import { mockDeployments } from "../support/deploymentRpc";

// The app is one bundle (app.js) plus the page module. Exact's runtime adds
// its own hashed chunks, some on first use; navigation never loads app code.
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
    page.getByRole("heading", { name: "Your FreeLP positions", exact: true }),
  ).toBeVisible();
  const initial = [...scripts];
  expect(initial.filter((url) => url.endsWith("/app.js"))).toHaveLength(1);
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Terms of Service" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Networks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Networks", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#/deploy/1";
  });
  await expect(
    page.getByRole("heading", { name: "Deploy contracts" }),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#/create";
  });
  await expect(
    page.getByRole("button", { name: "Select first token" }),
  ).toBeVisible();
  const runtime = /\/[a-z-]+-[\w-]{8}\.js$/;
  expect(scripts.slice(0, initial.length)).toEqual(initial);
  expect(scripts.slice(initial.length).every((url) => runtime.test(url))).toBe(
    true,
  );
  for (const own of ["/app.js", "/modules/index.js"])
    expect(scripts.filter((url) => url.endsWith(own))).toHaveLength(1);
});
