import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockDeployments } from "../support/deploymentRpc";
import { mockPoolData } from "../support/poolRpc";
import { mockRegistry, fixturePools, BASE_PAIR } from "../support/registryRpc";
import { createFormHash, defaultCreateForm } from "../../src/createForm";

for (const width of [390, 768, 1440]) {
  test(`creation stays aligned and usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("https://**", (route) => route.abort());
    await mockDeployments(page);
    await mockPoolData(page, true);
    await mockRegistry(page, fixturePools());
    await page.goto(
      "/" +
        createFormHash({
          ...defaultCreateForm(8453),
          a: BASE_PAIR.token0,
          b: BASE_PAIR.token1,
        }),
    );
    await page.getByTestId("deposit-amount-0").fill("1");
    await expect(
      page.getByRole("heading", { name: "Deposit preview", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Create", exact: true }),
    ).toHaveCount(0);
    const [pair0, pair1, lower, upper, range, deposit] = await Promise.all([
      page.getByRole("button", { name: "Select first token" }).boundingBox(),
      page.getByRole("button", { name: "Select second token" }).boundingBox(),
      page.getByLabel("Minimum price", { exact: true }).boundingBox(),
      page.getByLabel("Maximum price", { exact: true }).boundingBox(),
      page.locator(".range-section").boundingBox(),
      page.locator(".create-deposit").boundingBox(),
    ]);
    expect(Math.abs(pair0!.y - pair1!.y)).toBeLessThan(1);
    expect(Math.abs(pair0!.width - pair1!.width)).toBeLessThan(1);
    expect(Math.abs(lower!.y - upper!.y)).toBeLessThan(1);
    expect(Math.abs(lower!.width - upper!.width)).toBeLessThan(1);
    if (width > 900)
      expect(deposit!.x).toBeGreaterThan(range!.x + range!.width);
    else expect(deposit!.y).toBeGreaterThanOrEqual(range!.y + range!.height);
    await page.getByRole("switch", { name: "Advanced", exact: true }).click();
    await expect(page.getByLabel("Extension address")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`create-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "All positions", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your FreeLP positions" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Create position", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Create position", exact: true }),
    ).toBeVisible();
  });
}
