import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { spawn } from "node:child_process";
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
async function checkRunner(command: string[]) {
  const nodePath = dirname(Bun.which("node")!);
  const child = spawn(
    command[0],
    [...command.slice(1), "--no-browser", "--port", "19419"],
    {
      cwd: directory,
      detached: true,
      stdio: "inherit",
      env: { ...process.env, PATH: `${nodePath}:/usr/bin:/bin` },
    },
  );
  const exited = new Promise<void>((resolve, reject) => {
    child.once("exit", () => resolve());
    child.once("error", reject);
  });
  try {
    const html = await (await waitForPage()).text();
    if (!html.includes("FreeLP")) throw new Error("Missing application HTML.");
    const script = html.match(/src="([^"]+\.js)"/)?.[1];
    if (!script) throw new Error("Missing bundled script.");
    if (!(await fetch(new URL(script, "http://127.0.0.1:19419/"))).ok)
      throw new Error("Missing packaged assets.");
    if ((await fetch("http://127.0.0.1:19419/.env")).status !== 404)
      throw new Error("Unexpected filesystem access.");
    console.log("Packaged app served with:", command.join(" "));
  } finally {
    if (child.pid && child.exitCode === null)
      process.kill(-child.pid, "SIGTERM");
    await exited;
  }
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
  await checkRunner([Bun.which("bun")!, "x", "--no-install", "@ekubo/freelp"]);
  await checkRunner([
    Bun.which("npx")!,
    "--offline",
    "--no-install",
    "--",
    "@ekubo/freelp",
  ]);
} finally {
  await rm(directory, { recursive: true, force: true });
}
