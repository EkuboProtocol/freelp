import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const executable = resolve(process.argv[2] ?? ".cache/freelp");
const directory = await mkdtemp(join(tmpdir(), "freelp-untrusted-config-"));
try {
  await writeFile(
    join(directory, "bunfig.toml"),
    'preload = ["./preload.ts"]\n',
  );
  await writeFile(join(directory, ".env"), "FREELP_UNTRUSTED_CONFIG=1\n");
  await writeFile(
    join(directory, "preload.ts"),
    'await Bun.write("executed", "untrusted preload");\n',
  );
  const { stdout } = await promisify(execFile)(executable, ["--help"], {
    cwd: directory,
  });
  if (!stdout.includes("freelp")) throw new Error("Launcher help failed.");
  const marker = await readFile(join(directory, "executed")).catch(
    () => undefined,
  );
  if (marker) throw new Error("Launcher executed an untrusted local preload.");
  console.log(
    "Launcher ignored untrusted working-directory preload configuration.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
