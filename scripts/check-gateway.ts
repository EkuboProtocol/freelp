import { chromium, expect, type Browser } from "@playwright/test";

async function check(browser: Browser, base: string) {
  const page = await browser.newPage();
  const failures: string[] = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === new URL(base).origin)
      return route.continue();
    failures.push(route.request().url());
    return route.abort();
  });
  try {
    await page.goto(base + "#/terms");
    await expect(
      page.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Connection settings" }),
    ).toBeVisible();
    expect(failures).toEqual([]);
    console.log("Gateway deep links and local assets verified:", base);
  } finally {
    await page.close();
  }
}

const cid = process.argv[2];
const port = process.argv[3] ?? "8080";
if (!/^bafy[a-z2-7]{55}$/.test(cid ?? "") || !/^\d{2,5}$/.test(port))
  throw new Error("Usage: bun scripts/check-gateway.ts RELEASE_CID [PORT]");
const browser = await chromium.launch();
try {
  await check(browser, `http://127.0.0.1:${port}/ipfs/${cid}/`);
  await check(browser, `http://${cid}.ipfs.localhost:${port}/`);
} finally {
  await browser.close();
}
