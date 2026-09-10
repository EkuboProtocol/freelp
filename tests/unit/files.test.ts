import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLimited } from "../../cli/files";

test("local bundle files are bounded before loading and directories are rejected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "freelp-files-"));
  try {
    const path = join(dir, "application.json");
    await writeFile(path, "12345");
    expect((await readLimited(path, 5)).toString()).toBe("12345");
    await expect(readLimited(path, 4)).rejects.toThrow("size limit");
    await expect(readLimited(dir, 5)).rejects.toThrow("regular file");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
