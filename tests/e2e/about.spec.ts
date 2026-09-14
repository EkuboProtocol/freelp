import { test, expect } from "@playwright/test";
import pkg from "../../package.json" with { type: "json" };
const { version } = pkg;
import source from "../../artifacts/source.json" with { type: "json" };
import { mockDeployments } from "../support/deploymentRpc";

test("the footer links GitHub and shows the version, and About holds one run command and the source pin", async ({
  page,
}) => {
  await mockDeployments(page);
  await page.goto("/#/networks");
  const footer = page.locator("footer");
  await expect(footer.getByText(`v${version}`)).toBeVisible();
  const github = footer.getByRole("link", { name: "FreeLP on GitHub" });
  await expect(github).toHaveAttribute(
    "href",
    "https://github.com/EkuboProtocol/freelp",
  );
  await expect(github.locator("svg")).toBeVisible();
  await footer.getByRole("link", { name: "About FreeLP" }).click();
  await expect(
    page.getByRole("heading", { name: "About FreeLP", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Build details")).toHaveCount(0);
  await expect(page.locator(".command")).toHaveCount(1);
  await expect(page.locator("#main-content")).not.toContainText(
    /0x[0-9a-fA-F]{40}/,
  );
  await expect(page.getByText(`FreeLP ${version}`)).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: `${source.repository}@${source.commit.slice(0, 7)}`,
    }),
  ).toHaveAttribute(
    "href",
    `https://github.com/${source.repository}/commit/${source.commit}`,
  );
  for (const name of ["MIT license", "Contract license", "Dependency notices"])
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
});
