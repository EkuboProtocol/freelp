import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const base = process.argv[2] ?? "http://127.0.0.1:14177/";
const output = resolve(process.argv[3] ?? ".cache/ux-audit");
await mkdir(output, { recursive: true });
const cli = fileURLToPath(
  new URL("../cli/index.js", import.meta.resolve("lighthouse")),
);
const thresholds: Record<string, number> = {
  performance: 90,
  accessibility: 100,
  "best-practices": 95,
  seo: 90,
};
const summary = [];
for (const device of ["mobile", "desktop"]) {
  const path = `${output}/lighthouse-${device}.json`;
  const command = [
    "node",
    cli,
    base,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--chrome-flags=--headless --no-sandbox",
    "--output=json",
    `--output-path=${path}`,
    "--quiet",
  ];
  if (device === "desktop") command.push("--preset=desktop");
  const run = Bun.spawn(command, {
    env: { ...process.env, CHROME_PATH: chromium.executablePath() },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await run.exited) throw new Error("Lighthouse did not complete.");
  const report = JSON.parse(await readFile(path, "utf8"));
  const scores = Object.fromEntries(
    Object.entries(report.categories as Record<string, { score: number }>).map(
      ([name, category]) => [name, Math.round(category.score * 100)],
    ),
  );
  summary.push({ device, scores });
  for (const [name, threshold] of Object.entries(thresholds))
    if (scores[name] < threshold) process.exitCode = 1;
}
console.log(JSON.stringify(summary));
await writeFile(
  `${output}/lighthouse-summary.json`,
  JSON.stringify({ thresholds, results: summary }, null, 2),
);
