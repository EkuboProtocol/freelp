import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("wallet errors render messages and the connected account has a local header identicon", async ({
  page,
}) => {
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
  await expect(page.locator(".status[role=status]")).toContainText("Request declined");
  await expect(page.locator("body")).not.toContainText("[object Object]");
  await page.getByRole("button", { name: "Connect Test wallet" }).click();
  const account = page.locator("header .account-control");
  await expect(account.locator("svg")).toBeVisible();
  await account.locator("summary").click();
  await expect(account.locator(".account-menu")).toContainText(
    "0x1111111111111111111111111111111111111111",
  );
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
});
