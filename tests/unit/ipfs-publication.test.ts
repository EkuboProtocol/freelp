import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/seed-release.sh");
test("IPFS publication rejects private builds and uses a fresh public blockstore", async () => {
  const dir = await mkdtemp(join(tmpdir(), "freelp-publication-"));
  try {
    await mkdir(join(dir, ".cache/bin"), { recursive: true });
    await mkdir(join(dir, "release"));
    await writeFile(
      join(dir, "release/deployment.json"),
      JSON.stringify({ siteCid: "site-cid", releaseCid: "release-cid" }),
    );
    await writeFile(
      join(dir, ".cache/bin/ipfs"),
      `#!/usr/bin/env bun
import { appendFileSync, writeFileSync } from "node:fs";
appendFileSync("calls.jsonl", JSON.stringify({ args: process.argv.slice(2), repo: process.env.IPFS_PATH }) + "\\n");
if (process.argv[2] === "daemon") writeFileSync(process.env.IPFS_PATH + "/api", "test");
`,
      { mode: 0o700 },
    );
    const env = { ...process.env, IPFS_PATH: join(dir, "private-existing") };
    const denied = Bun.spawn(["bash", script], {
      cwd: dir,
      env: { ...env, FREELP_PUBLIC_RELEASE: "false" },
      stderr: "pipe",
    });
    expect(await denied.exited).toBe(1);
    expect(await new Response(denied.stderr).text()).toContain(
      "disabled for private",
    );
    expect(await Bun.file(join(dir, "calls.jsonl")).exists()).toBe(false);
    const allowed = Bun.spawn(["bash", script], {
      cwd: dir,
      env: { ...env, FREELP_PUBLIC_RELEASE: "true" },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await allowed.exited).toBe(0);
    const calls = (await readFile(join(dir, "calls.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { args: string[]; repo: string });
    expect(new Set(calls.map((call) => call.repo)).size).toBe(1);
    expect(calls[0].repo).toStartWith(join(dir, ".cache/ipfs-public-"));
    expect(calls.map((call) => call.args)).toContainEqual([
      "--offline",
      "dag",
      "import",
      "release/site.car",
    ]);
    expect(calls.at(-1)?.args).toEqual([
      "--timeout=2m",
      "routing",
      "provide",
      "site-cid",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
