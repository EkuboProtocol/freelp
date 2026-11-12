import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("wallet errors render messages and the connected account has a local header identicon", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    let failed = false;
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "test", name: "Test wallet" },
            provider: {
              request: async () => {
                if (!failed) {
                  failed = true;
                  throw { code: 4001, message: "Request declined" };
                }
                return ["0x1111111111111111111111111111111111111111"];
              },
            },
          },
        }),
      );
    });
  });
  await page.goto("/#/build");
  await page.getByRole("button", { name: "Connect Test wallet" }).click();
  await expect(
    page.getByLabel("Notification", { exact: true }).getByRole("status"),
  ).toContainText("Request declined");
  await expect(page.locator("body")).not.toContainText("[object Object]");
  await expect(page.getByLabel("Notification", { exact: true })).toHaveCSS(
    "position",
    "sticky",
  );
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.getByLabel("Notification", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Connect Test wallet" }).click();
  const control = page.getByRole("button", { name: /^Connected wallet: / });
  await expect(control.locator("svg")).toBeVisible();
  await control.click();
  const account = page.getByRole("dialog", { name: "Account" });
  await expect(account).toContainText(
    "0x1111111111111111111111111111111111111111",
  );
  await account
    .getByRole("button", { name: "Copy address", exact: true })
    .click();
  await expect(
    account.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await expect(
    account.getByRole("button", { name: "Copy address", exact: true }),
  ).toBeVisible({ timeout: 2000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: test.info().outputPath(`account-${width}.png`),
    });
  }
  await account.getByRole("button", { name: "Disconnect wallet" }).click();
  await expect(
    page.getByRole("button", { name: "Connect Test wallet" }),
  ).toBeVisible();
  await expect(control).toHaveCount(0);
  await page.getByRole("button", { name: "Connect Test wallet" }).click();
  await expect(control).toBeVisible();
});

test("long notifications scroll within the viewport and remain dismissible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.addInitScript(() => {
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "long-error", name: "Test wallet" },
            provider: {
              request: async () => {
                throw new Error("Wallet request failed. ".repeat(500));
              },
            },
          },
        }),
      );
    });
  });
  await page.goto("/#/build");
  await page.getByRole("button", { name: "Connect Test wallet" }).click();
  const toast = page.getByLabel("Notification", { exact: true });
  await expect(toast).toBeVisible();
  const bounds = await toast.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(600);
  const status = toast.getByRole("status");
  expect(
    await status.evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(true);
  await status.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => status.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: test.info().outputPath("long-toast-mobile.png"),
  });
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toHaveCount(0);
});
