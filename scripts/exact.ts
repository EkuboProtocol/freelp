// Exact toolchain for FreeLP: `setup` checks out the pinned Exact commit into
// .exact-sdk and applies patches/exact, `build` compiles the app into dist as a static, relative site.
import { existsSync } from "node:fs";
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { DEPLOYED_ARTIFACTS } from "./artifact-derivatives";

const SDK = ".exact-sdk";
// Fixes FreeLP needs before they land upstream, applied to the pinned commit.
const PATCHES = "patches/exact";
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
  await run(["git", "checkout", "-q", "--", "."], SDK);
  for (const name of (await readdir(PATCHES)).sort())
    await run(["git", "apply", resolve(PATCHES, name)], SDK);
  await run(["bun", "install", "--frozen-lockfile"], SDK);
}

// Files the first screen asks for only after app.js runs: the stylesheet,
// the runtime's chunks and the page module (wallets and saved settings).
// Asking for them with app.js saves a round trip each on a slow link.
const BOOT_FILES = [
  /^native-[\w-]+\.js$/,
  /^geometry-glue-[\w-]+\.js$/,
  /^input-glue-[\w-]+\.js$/,
];
async function bootPreloads() {
  const files = await readdir("dist");
  const chunks = BOOT_FILES.map((pattern) => {
    const found = files.filter((name) => pattern.test(name));
    if (found.length !== 1)
      throw new Error(`Expected one boot chunk for ${pattern}.`);
    return found[0];
  });
  return [
    '<link rel="preload" as="style" href="./style.css">',
    ...[...chunks, "modules/index.js"].map(
      (name) =>
        `<link rel="modulepreload" href="./${name}" fetchpriority="low">`,
    ),
  ].join("\n");
}

// A page rendered at build starts Exact from an inline script, which a
// gateway policy refusing inline scripts blocks: serve it as a file instead.
// It waits for the first paint before it imports app.js, so async loses
// nothing.
const INLINE_SCRIPT = /<script>([^<]*)<\/script>/g;
async function externalBoot(html: string) {
  const scripts = [...html.matchAll(INLINE_SCRIPT)];
  if (!scripts.length) return html;
  if (scripts.length !== 1) throw new Error("Expected one inline boot script.");
  await writeFile("dist/exact-boot.js", scripts[0][1]);
  return html.replace(
    scripts[0][0],
    '<script src="./exact-boot.js" async></script>',
  );
}

async function build() {
  await setup();
  await rm("dist", { recursive: true, force: true });
  await run(["bun", "exact.mjs", "web-build", "--out", "dist"]);
  // The app is served from a content address or a local launcher, never from
  // a fixed origin root: anchor every document at its own directory.
  const preloads = await bootPreloads();
  for (const name of ["index.html", "shell.html", "404.html"]) {
    const file = `dist/${name}`;
    if (!existsSync(file)) continue;
    const html = await readFile(file, "utf8");
    if (!html.includes('<base href="/">') || !html.includes("modulepreload"))
      throw new Error(`${name} has no root base or module preload.`);
    await writeFile(
      file,
      (await externalBoot(html))
        .replace('<base href="/">', '<base href="./">')
        .replace(
          /(<link rel="modulepreload"[^>]*>\n)(?!<link rel="modulepreload")/,
          `$1${preloads}\n`,
        ),
    );
  }
  // Native install pages and build records are not part of the website.
  await rm("dist/.exact", { recursive: true, force: true });
  await rm("dist/.exact-build.json", { force: true });
  await cp("public", "dist", { recursive: true });
  // Deploying and checking a network's code fetch these, verified by digest.
  for (const name of DEPLOYED_ARTIFACTS)
    await cp(`artifacts/${name}.json`, `dist/artifacts/${name}.json`);
}

const command = process.argv[2];
if (command === "setup") await setup();
else if (command === "build") await build();
else throw new Error("Usage: bun scripts/exact.ts setup|build");
