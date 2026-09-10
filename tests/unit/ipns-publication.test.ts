import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("IPNS public publication is refused before accessing a key while launch is disabled", async () => {
  const run = Bun.spawn(["bash", "scripts/update-ipns.sh"], {
    env: {
      ...process.env,
      FREELP_IPNS_DRY_RUN: "false",
      FREELP_PUBLIC_RELEASE: "false",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await run.exited).not.toBe(0);
});
test("public IPNS publication is refused for a private repository even with the launch switch set", async () => {
  const directory = await mkdtemp(join(tmpdir(), "freelp-ipns-guard-"));
  try {
    await writeFile(join(directory, "gh"), '#!/bin/sh\nprintf "true\\n"\n');
    await chmod(join(directory, "gh"), 0o755);
    const run = Bun.spawn(["bash", "scripts/update-ipns.sh"], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        FREELP_IPNS_DRY_RUN: "false",
        FREELP_PUBLIC_RELEASE: "true",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await run.exited).not.toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("dedicated pinning SSH command rejects shell commands and malformed identities", async () => {
  for (const command of [
    "sh",
    "freelp-pin ../../bad bafybad",
    "freelp-pin abc; touch /tmp/should-not-exist",
    "",
  ]) {
    const run = Bun.spawn(["bash", "deploy/receive-release.sh"], {
      env: { ...process.env, SSH_ORIGINAL_COMMAND: command },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await run.exited).not.toBe(0);
  }
});
