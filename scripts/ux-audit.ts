import { mockDeployments } from "../tests/support/deploymentRpc";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const base = process.argv[2] ?? "http://127.0.0.1:14177/";
const output = resolve(process.argv[3] ?? ".cache/ux-audit");
await mkdir(output, { recursive: true });
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* Preview is starting. */
  }
  await Bun.sleep(250);
}
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await mockDeployments(page);
    for (const route of [
      "positions",
      "create",
      "settings",
      "deploy",
      "terms",
      "build",
    ]) {
      await page.goto(`${base}#/${route}`);
      await page.waitForLoadState("networkidle");
      const audit = await new AxeBuilder({ page })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21aa",
          "wcag22aa",
          "best-practice",
        ])
        .analyze();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      results.push({
        route,
        width,
        overflow,
        violations: audit.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          elements: nodes.map((node) => node.target),
        })),
      });
      await page.screenshot({
        path: `${output}/${route}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto(`${base}#/create`);
    await page.getByRole("button", { name: "Select first token" }).click();
    const modal = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    results.push({
      route: "token-dialog",
      width,
      overflow: false,
      violations: modal.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        elements: nodes.map((node) => node.target),
      })),
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Select first token" }),
    ).toBeFocused();
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `${output}/accessibility.json`,
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
if (results.some((result) => result.overflow || result.violations.length))
  process.exitCode = 1;
