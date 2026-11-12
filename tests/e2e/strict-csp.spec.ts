import { test, expect } from "@playwright/test";
import pkg from "../../package.json" with { type: "json" };

// Many IPFS gateways serve every file with a policy that refuses inline
// scripts. The app, Exact's runtime and the page module must all still load.
const POLICY =
  "default-src 'self'; img-src * data: blob: 'unsafe-inline'; style-src * 'unsafe-inline';";

test("the app, its wallets and storage work under a gateway's strict content security policy", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy"))
      violations.push(message.text());
  });
  await page.route("http://127.0.0.1:14173/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": POLICY },
    });
  });
  await page.addInitScript(() => {
    const provider = {
      request: async () => ["0x1111111111111111111111111111111111111111"],
    };
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: { info: { uuid: "ambire", name: "Ambire" }, provider },
        }),
      ),
    );
  });
  await page.goto("/#/positions");
  await expect(
    page.getByRole("button", { name: "Connect Ambire", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(`v${pkg.version}`)).toBeVisible();
  expect(violations).toEqual([]);
});
