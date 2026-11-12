// Exact toolchain for FreeLP: `setup` checks out the pinned Exact commit into
// .exact-sdk, `build` compiles the app into dist as a static, relative site.
import { existsSync } from "node:fs";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import pkg from "../package.json" with { type: "json" };

const SDK = ".exact-sdk";
const { repository, commit } = pkg.exact;
const env = { ...process.env, EXACT: SDK, EXACT_FEEDBACK: "0" };

async function run(cmd: string[], cwd = ".") {
  const child = Bun.spawn(cmd, {
    cwd,
    env,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await child.exited) throw new Error(`Failed: ${cmd.join(" ")}`);
}
async function output(cmd: string[], cwd = ".") {
  const child = Bun.spawn(cmd, { cwd, env, stdout: "pipe", stderr: "ignore" });
  return (await new Response(child.stdout).text()).trim();
}

async function setup() {
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new Error("Pin a full Exact commit.");
  if (!existsSync(`${SDK}/.git`)) {
    await run(["git", "init", "-q", SDK]);
    await run(["git", "remote", "add", "origin", repository], SDK);
  }
  if ((await output(["git", "rev-parse", "HEAD"], SDK)) !== commit) {
    await run(["git", "fetch", "-q", "--depth", "1", "origin", commit], SDK);
    await run(["git", "checkout", "-q", "--detach", commit], SDK);
  }
  await run(["bun", "install", "--frozen-lockfile"], SDK);
}

async function build() {
  await setup();
  await rm("dist", { recursive: true, force: true });
  await run(["bun", "exact.mjs", "web-build", "--out", "dist"]);
  // The app is served from a content address or a local launcher, never from
  // a fixed origin root: anchor every document at its own directory.
  for (const name of ["index.html", "shell.html"]) {
    const file = `dist/${name}`;
    if (!existsSync(file)) continue;
    const html = await readFile(file, "utf8");
    if (!html.includes('<base href="/">'))
      throw new Error(`${name} has no root base to relativise.`);
    await writeFile(file, html.replace('<base href="/">', '<base href="./">'));
  }
  // Native install pages and build records are not part of the website.
  await rm("dist/.exact", { recursive: true, force: true });
  await rm("dist/.exact-build.json", { force: true });
  await cp("public", "dist", { recursive: true });
}

const command = process.argv[2];
if (command === "setup") await setup();
else if (command === "build") await build();
else throw new Error("Usage: bun scripts/exact.ts setup|build");
