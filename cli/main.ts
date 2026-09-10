#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import {
  REPOSITORY,
  verifyPrivateProof,
  verifyPublicProof,
  type PrivateProof,
} from "./provenance";
import {
  verifyApplication,
  sha256,
  MAX_BYTES,
  type ReleaseDescriptor,
} from "./content";
import { serve } from "./server";
import { readLimited } from "./files";
const exec = promisify(execFile);
const cache = join(homedir(), ".cache", "freelp");
const { values } = parseArgs({
  options: {
    version: { type: "string" },
    offline: { type: "boolean" },
    "no-browser": { type: "boolean" },
    bundle: { type: "string" },
    port: { type: "string" },
    "private-build": { type: "boolean" },
    help: { type: "boolean" },
    "verify-only": { type: "boolean" },
  },
  strict: true,
});
type Release = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { id: number; name: string; size: number }[];
};
async function github(path: string) {
  const { stdout } = await exec("gh", ["api", path], {
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout);
}
async function downloadAssets(release: Release, stage: string) {
  for (const name of [
    "descriptor.json",
    "application.json",
    "provenance.json",
  ]) {
    const asset = release.assets.find((a) => a.name === name);
    if (!asset || asset.size > MAX_BYTES)
      throw new Error(`Missing or oversized ${name}.`);
    const { stdout } = await exec(
      "gh",
      [
        "api",
        `repos/${REPOSITORY}/releases/assets/${asset.id}`,
        "-H",
        "Accept: application/octet-stream",
      ],
      { encoding: "buffer", maxBuffer: MAX_BYTES },
    );
    await writeFile(join(stage, name), stdout);
  }
}
async function fetchRelease() {
  const version = values.version;
  if (version && !/^v\d+\.\d+\.\d+$/.test(version))
    throw new Error("Version must be vMAJOR.MINOR.PATCH.");
  const release = (await github(
    `repos/${REPOSITORY}/releases/${version ? "tags/" + version : "latest"}`,
  )) as Release;
  if (
    release.draft ||
    release.prerelease ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag_name)
  )
    throw new Error("Not an official stable release.");
  const stage = await mkdtemp(join(cache, ".download-"));
  try {
    await downloadAssets(release, stage);
    const source = (await github(
      `repos/${REPOSITORY}/commits/${release.tag_name}`,
    )) as { sha: string };
    return { stage, tag: release.tag_name, commit: source.sha };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}
async function verifyDirectory(dir: string, privateBuild = false) {
  const bytes = await readLimited(join(dir, "descriptor.json"), 1024 * 1024);
  const proofBytes = await readLimited(
    join(dir, "provenance.json"),
    1024 * 1024,
  );
  let descriptor: ReleaseDescriptor;
  if (privateBuild) {
    const proof = JSON.parse(proofBytes.toString("utf8")) as PrivateProof;
    if (proof.type !== "github-oidc")
      throw new Error("Missing private CI proof.");
    descriptor = await verifyPrivateProof(bytes, proof);
  } else {
    descriptor = await verifyPublicProof(bytes, proofBytes);
  }
  const app = await readLimited(join(dir, "application.json"), MAX_BYTES);
  const files = await verifyApplication(app, descriptor);
  return { descriptor, files, digest: sha256(bytes) };
}
function compareVersions(a: string, b: string) {
  const left = a.slice(1).split(".").map(Number),
    right = b.slice(1).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}
async function launchOffline() {
  const latest = JSON.parse(
    await readFile(join(cache, "selected.json"), "utf8"),
  ) as { digest: string; privateBuild: boolean };
  if (!/^[a-f0-9]{64}$/.test(latest.digest))
    throw new Error("Invalid cache selection.");
  console.log(
    "Offline: verifying cached build; update/revocation freshness is unknown.",
  );
  return verifyDirectory(join(cache, latest.digest), latest.privateBuild);
}
async function promote(stage: string, digest: string) {
  const destination = join(cache, digest);
  try {
    await rename(stage, destination);
  } catch (error) {
    if (
      !["EEXIST", "ENOTEMPTY"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
    await rm(destination, { recursive: true, force: true });
    await rename(stage, destination);
  }
}
async function importBundle(dir: string, privateBuild: boolean) {
  const stage = await mkdtemp(join(cache, ".import-"));
  try {
    for (const name of [
      "descriptor.json",
      "application.json",
      "provenance.json",
    ])
      await writeFile(
        join(stage, name),
        await readLimited(join(dir, name), MAX_BYTES),
      );
    // Reverify the copied bytes before caching; source files may have changed during the import.
    const result = await verifyDirectory(stage, privateBuild);
    await promote(stage, result.digest);
    await writeFile(
      join(cache, "selected.json"),
      JSON.stringify({ digest: result.digest, privateBuild }),
    );
    return result;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
async function launch() {
  await mkdir(cache, { recursive: true });
  if (values.offline) return launchOffline();
  if (values.bundle)
    return importBundle(resolve(values.bundle), !!values["private-build"]);
  const release = await fetchRelease();
  try {
    const result = await verifyDirectory(
      release.stage,
      !!values["private-build"],
    );
    if (
      result.descriptor.commit !== release.commit ||
      result.descriptor.ref !== `refs/tags/${release.tag}`
    )
      throw new Error("Release tag and attested source do not match.");
    let highest = "v0.0.0";
    try {
      highest = (
        JSON.parse(await readFile(join(cache, "highest.json"), "utf8")) as {
          tag: string;
        }
      ).tag;
    } catch {
      /* First launch. */
    }
    if (!values.version && compareVersions(release.tag, highest) < 0)
      throw new Error(
        "Release rollback detected. Select an older version explicitly.",
      );
    await promote(release.stage, result.digest);
    await writeFile(
      join(cache, "selected.json"),
      JSON.stringify({
        digest: result.digest,
        privateBuild: !!values["private-build"],
      }),
    );
    if (compareVersions(release.tag, highest) > 0)
      await writeFile(
        join(cache, "highest.json"),
        JSON.stringify({ tag: release.tag }),
      );
    return result;
  } finally {
    await rm(release.stage, { recursive: true, force: true });
  }
}
if (values.help) {
  console.log(
    "freelp [--version vX.Y.Z] [--offline] [--bundle DIRECTORY] [--private-build] [--no-browser] [--port 4173]\nRequires GitHub CLI for release discovery and public Sigstore verification. Install the initial CLI from an independently verified official source.",
  );
} else {
  try {
    const result = await launch();
    console.log(
      `Verified ${REPOSITORY}\nCommit: ${result.descriptor.commit}\nIPFS: ${result.descriptor.siteCid}`,
    );
    const port = Number(values.port ?? 4173);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error("Port must be 1024–65535.");
    if (values["verify-only"]) process.exit(0);
    const server = await serve(result.files, port, !values["no-browser"]);
    process.on("SIGINT", () => server.close(() => process.exit(0)));
    process.on("SIGTERM", () => server.close(() => process.exit(0)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      "Nothing was launched. Use --offline to explicitly launch a previously verified cached release.",
    );
    process.exitCode = 1;
  }
}
