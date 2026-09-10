import supplements from "./license-supplements.json" with { type: "json" };
import { readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Package = {
  name: string;
  version: string;
  license?: string;
  author?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
async function packageDirectory(name: string, from: string) {
  for (let dir = from; ; dir = dirname(dir)) {
    try {
      return await realpath(join(dir, "node_modules", name));
    } catch {
      if (dir === root || dir === dirname(dir))
        throw new Error("Missing runtime dependency: " + name);
    }
  }
}
async function licenseText(dir: string) {
  const names = (await readdir(dir))
    .filter((name) =>
      /^(licen[cs]e|copying|notice|copyright)([.-]|$)/i.test(name),
    )
    .sort();
  const texts = await Promise.all(
    names.map(async (name) => {
      try {
        return await readFile(join(dir, name), "utf8");
      } catch {
        throw new Error("Cannot read license file: " + join(dir, name));
      }
    }),
  );
  return texts.join("\n\n");
}
const root = resolve(".");
const app = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
) as Package;
const queue = await Promise.all(
  Object.keys(app.dependencies ?? {}).map((name) =>
    packageDirectory(name, root),
  ),
);
const packages = new Map<string, { info: Package; text: string }>();
while (queue.length) {
  const dir = queue.pop()!;
  const info = JSON.parse(
    await readFile(join(dir, "package.json"), "utf8"),
  ) as Package;
  const id = info.name + "@" + info.version;
  if (packages.has(id)) continue;
  const extra =
    (supplements as Record<string, { source: string; text: string }[]>)[id] ??
    [];
  const text =
    (await licenseText(dir)) ||
    extra
      .map((record) => "Source: " + record.source + "\n" + record.text)
      .join("\n\n");
  if (!text || !info.license)
    throw new Error("Dependency notices need review: " + id);
  packages.set(id, { info, text });
  for (const name of Object.keys(info.dependencies ?? {}))
    queue.push(await packageDirectory(name, dir));
  const optional = { ...info.peerDependencies, ...info.optionalDependencies };
  for (const name of Object.keys(optional)) {
    const dependency = await packageDirectory(name, dir).catch(() => undefined);
    if (dependency) queue.push(dependency);
  }
}
let output =
  "Installed runtime dependency notices (including transitive dependencies).\nGenerated from the locked installation by scripts/notices.ts.\n";
for (const [id, { info, text }] of [...packages].sort(([a], [b]) =>
  a < b ? -1 : 1,
)) {
  output +=
    "\n---\n" + id + "\nLicense: " + (info.license ?? "NOT DECLARED") + "\n";
  if (info.author)
    output += "Package author: " + JSON.stringify(info.author) + "\n";
  output += "\n" + (text || "No license text included in this package.") + "\n";
  if (!text || !info.license)
    console.log("REVIEW", id, info.license ?? "missing license");
}
output = output.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
if (process.argv.includes("--check")) {
  const committed = await readFile("public/licenses/dependencies.txt", "utf8");
  if (committed !== output)
    throw new Error(
      "Dependency notices are stale. Run bun scripts/notices.ts and review the changes.",
    );
} else {
  await writeFile("public/licenses/dependencies.txt", output);
}
console.log("Recorded notices for", packages.size, "runtime packages.");
