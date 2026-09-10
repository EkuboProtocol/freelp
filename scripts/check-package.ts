import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const archive = resolve(process.argv[2]);
const directory = await mkdtemp(join(tmpdir(), "freelp-package-"));
async function waitForPage() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:19419/");
      if (response.ok) return response;
    } catch {
      /* Server is starting. */
    }
    await Bun.sleep(100);
  }
  throw new Error("Packaged app did not start.");
}
try {
  const install = Bun.spawn(
    [
      "npm",
      "install",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
      "--prefix",
      directory,
      archive,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (await install.exited)
    throw new Error(
      `Cannot install npm artifact: ${await new Response(install.stderr).text()}`,
    );
  const child = Bun.spawn(
    [
      "bun",
      "x",
      "--no-install",
      "@ekubo/freelp",
      "--no-browser",
      "--port",
      "19419",
    ],
    { cwd: directory, stdout: "pipe", stderr: "pipe" },
  );
  try {
    const html = await (await waitForPage()).text();
    if (!html.includes("FreeLP")) throw new Error("Missing application HTML.");
    const script = html.match(/src="([^"]+\.js)"/)?.[1];
    if (!script) throw new Error("Missing bundled script.");
    if (!(await fetch(new URL(script, "http://127.0.0.1:19419/"))).ok)
      throw new Error("Missing packaged assets.");
    if ((await fetch("http://127.0.0.1:19419/.env")).status !== 404)
      throw new Error("Unexpected filesystem access.");
    console.log(
      "Offline npm install and bunx serve the complete packaged app without a source checkout.",
    );
  } finally {
    child.kill("SIGTERM");
    await child.exited;
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
