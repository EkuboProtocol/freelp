import { test, expect } from "@playwright/test";

const provider = () => ({
  request: async () => ["0x1111111111111111111111111111111111111111"],
});

test("an announced wallet suppresses the injected fallback even through a different window.ethereum wrapper", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const announced = {
      request: async () => ["0x1111111111111111111111111111111111111111"],
    };
    // Wallets commonly expose a distinct wrapper on window.ethereum.
    Object.defineProperty(window, "ethereum", {
      value: { request: () => announced.request() },
      configurable: true,
    });
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "ambire", name: "Ambire" },
            provider: announced,
          },
        }),
      ),
    );
  });
  await page.goto("/#/build");
  await expect(
    page.getByRole("button", { name: "Connect Ambire", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(600);
  await expect(
    page.getByRole("button", { name: "Connect Injected wallet", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Connect / })).toHaveCount(1);
});

test("a legacy-only injection still offers the injected wallet", async ({
  page,
}) => {
  await page.addInitScript((source) => {
    Object.defineProperty(window, "ethereum", {
      value: new Function(`return (${source})()`)(),
      configurable: true,
    });
  }, provider.toString());
  await page.goto("/#/build");
  await expect(
    page.getByRole("button", { name: "Connect Injected wallet", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Connect / })).toHaveCount(1);
});
