import { test, expect } from "@playwright/test";
import { mockDeployments } from "../support/deploymentRpc";

// FreeLP is black on white. Exact's controls follow the system scheme unless
// the root fixes it, which turned their text white on white in dark mode.
test("controls stay legible when the system prefers dark", async ({ page }) => {
  await mockDeployments(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/#/create");
  const network = page.getByLabel("Network", { exact: true });
  await expect(network).toHaveValue("1");
  await expect(network).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "light");
});
