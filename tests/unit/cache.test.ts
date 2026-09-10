import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isVersion,
  compareVersions,
  readHighest,
  recordVersion,
  selectBundle,
  bundleDirectory,
} from "../../cli/cache";

test("release versions compare exactly beyond JavaScript integer precision", () => {
  expect(
    compareVersions("v9007199254740993.0.0", "v9007199254740992.99.99"),
  ).toBe(1);
  expect(compareVersions("v1.9.0", "v1.10.0")).toBe(-1);
  expect(compareVersions("v1.2.3", "v1.2.3")).toBe(0);
  for (const value of ["v01.0.0", "v1.0", "v1.0.0-rc1", "v1.0.0/../", null])
    expect(isVersion(value)).toBe(false);
});

test("concurrent cache updates retain the highest version and atomic selection", async () => {
  const dir = await mkdtemp(join(tmpdir(), "freelp-cache-"));
  try {
    expect(await readHighest(dir)).toBe("v0.0.0");
    await Promise.all([
      recordVersion(dir, "v2.0.0"),
      recordVersion(dir, "v1.0.0"),
    ]);
    await recordVersion(dir, "v0.1.0");
    expect(await readHighest(dir)).toBe("v2.0.0");
    const a = "a".repeat(64),
      b = "b".repeat(64);
    await Promise.all([
      selectBundle(dir, a, true),
      selectBundle(dir, b, false),
    ]);
    const selected = JSON.parse(
      await readFile(join(dir, "selected.json"), "utf8"),
    );
    expect([
      { digest: a, privateBuild: true, layout: 2 },
      { digest: b, privateBuild: false, layout: 2 },
    ]).toContainEqual(selected);
    expect(
      (await readdir(dir)).some((name) => name.startsWith(".write-")),
    ).toBe(false);
    expect(bundleDirectory(dir, a, true)).not.toBe(
      bundleDirectory(dir, a, false),
    );
    await writeFile(
      join(dir, "highest.json"),
      JSON.stringify({ tag: "v3.0.0" }),
    );
    expect(await readHighest(dir)).toBe("v3.0.0");
    await writeFile(join(dir, "highest.json"), "{}");
    await expect(readHighest(dir)).rejects.toThrow(
      "Invalid cached version history",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
