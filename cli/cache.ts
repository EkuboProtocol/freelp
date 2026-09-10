import { open, rename, rm, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { readLimited } from "./files";

export function isVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
  );
}
export function compareVersions(a: string, b: string) {
  if (!isVersion(a) || !isVersion(b))
    throw new Error("Invalid release version.");
  const left = a.slice(1).split(".").map(BigInt);
  const right = b.slice(1).split(".").map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}
export async function writeAtomic(path: string, bytes: Uint8Array | string) {
  const temporary = join(dirname(path), ".write-" + randomUUID());
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function selectBundle(
  cache: string,
  digest: string,
  privateBuild: boolean,
) {
  await writeAtomic(
    join(cache, "selected.json"),
    JSON.stringify({ digest, privateBuild, layout: 2 }),
  );
}
export function bundleDirectory(
  cache: string,
  digest: string,
  privateBuild: boolean,
) {
  return join(cache, privateBuild ? "private" : "public", digest);
}
function missing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
export async function readHighest(cache: string) {
  let highest = "v0.0.0";
  try {
    const legacy = JSON.parse(
      (await readLimited(join(cache, "highest.json"), 4096)).toString("utf8"),
    );
    if (!isVersion(legacy?.tag))
      throw new Error("Invalid cached version history.");
    highest = legacy.tag;
  } catch (error) {
    if (!missing(error)) throw error;
  }
  const names = await readdir(join(cache, "versions")).catch((error) => {
    if (!missing(error)) throw error;
    return [];
  });
  for (const version of names) {
    if (compareVersions(version, highest) > 0) highest = version;
  }
  return highest;
}
/** Immutable markers make concurrent updates monotonic without stale process locks. */
export async function recordVersion(cache: string, version: string) {
  if (!isVersion(version)) throw new Error("Invalid release version.");
  await mkdir(join(cache, "versions", version), {
    recursive: true,
    mode: 0o700,
  });
}
