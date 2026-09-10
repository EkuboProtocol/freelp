#!/usr/bin/env bun
import ownLicense from "../public/licenses/freelp.txt" with { type: "text" };
import dependencyNotices from "../public/licenses/dependencies.txt" with { type: "text" };
import runtimeNotices from "../public/licenses/bun-runtime.md" with { type: "text" };
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, mkdtemp, rename, rm, lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
import { releaseDag } from "./release";
import { downloadCid } from "./gateway";
import {
  isVersion,
  compareVersions,
  writeAtomic,
  selectBundle,
  bundleDirectory,
  readHighest,
  recordVersion,
} from "./cache";
import { BUNDLE_FILES } from "./release";
const exec = promisify(execFile);
const cache = join(homedir(), ".cache", "freelp");
const { values } = parseArgs({
  options: {
    version: { type: "string" },
    cid: { type: "string" },
    gateway: { type: "string" },
    offline: { type: "boolean" },
    "no-browser": { type: "boolean" },
    bundle: { type: "string" },
    port: { type: "string" },
    "private-build": { type: "boolean" },
    help: { type: "boolean" },
    licenses: { type: "boolean" },
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
function validAsset(asset: Release["assets"][number] | undefined) {
  return (
    !!asset &&
    Number.isSafeInteger(asset.id) &&
    asset.id > 0 &&
    Number.isSafeInteger(asset.size) &&
    asset.size >= 0 &&
    asset.size <= MAX_BYTES
  );
}
async function downloadAssets(release: Release, stage: string) {
  for (const name of [
    "descriptor.json",
    "application.json",
    "provenance.json",
  ]) {
    const matches = release.assets.filter((a) => a.name === name);
    const asset = matches[0];
    if (matches.length !== 1 || !validAsset(asset))
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
  if (version && !isVersion(version))
    throw new Error("Version must be vMAJOR.MINOR.PATCH.");
  const release = (await github(
    `repos/${REPOSITORY}/releases/${version ? "tags/" + version : "latest"}`,
  )) as Release;
  if (release.draft || release.prerelease || !isVersion(release.tag_name))
    throw new Error("Not an official stable release.");
  if (version && release.tag_name !== version)
    throw new Error("Requested release version mismatch.");
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
async function verifyDirectory(
  dir: string,
  privateBuild = false,
  expectedCid?: string,
) {
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
  if (expectedCid) {
    const { root } = await releaseDag(files, {
      "descriptor.json": bytes,
      "application.json": app,
      "provenance.json": proofBytes,
    });
    if (root.toString() !== expectedCid)
      throw new Error("Release CID mismatch.");
  }
  return { descriptor, files, digest: sha256(bytes) };
}
async function launchOffline() {
  const latest = JSON.parse(
    (await readLimited(join(cache, "selected.json"), 4096)).toString("utf8"),
  ) as { digest: string; privateBuild: boolean; layout?: number };
  if (
    !latest ||
    !/^[a-f0-9]{64}$/.test(latest.digest) ||
    typeof latest.privateBuild !== "boolean" ||
    (latest.layout !== undefined && latest.layout !== 2)
  )
    throw new Error("Invalid cache selection.");
  console.log(
    "Offline: verifying cached build; update/revocation freshness is unknown.",
  );
  const directory =
    latest.layout === 2
      ? bundleDirectory(cache, latest.digest, latest.privateBuild)
      : join(cache, latest.digest);
  const result = await verifyDirectory(directory, latest.privateBuild);
  if (result.digest !== latest.digest)
    throw new Error("Cached descriptor identity mismatch.");
  return result;
}
async function promote(stage: string, digest: string, privateBuild: boolean) {
  const destination = bundleDirectory(cache, digest, privateBuild);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  try {
    await rename(stage, destination);
  } catch (error) {
    if (
      !["EEXIST", "ENOTEMPTY"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
    if (!(await lstat(destination)).isDirectory())
      throw new Error("Cache destination must be a directory.", {
        cause: error,
      });
    // The descriptor digest fixes the app bytes. Atomic per-file replacement repairs
    // corrupt caches without deleting an existing valid offline copy first.
    for (const name of BUNDLE_FILES)
      await writeAtomic(
        join(destination, name),
        await readLimited(join(stage, name), MAX_BYTES),
      );
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
    await promote(stage, result.digest, privateBuild);
    await selectBundle(cache, result.digest, privateBuild);
    return result;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
async function launchCid(cid: string) {
  const stage = await mkdtemp(join(cache, ".ipfs-"));
  const privateBuild = !!values["private-build"];
  try {
    await downloadCid(
      cid,
      values.gateway ?? "http://127.0.0.1:8080",
      privateBuild,
      stage,
    );
    const result = await verifyDirectory(stage, privateBuild, cid);
    await promote(stage, result.digest, privateBuild);
    await selectBundle(cache, result.digest, privateBuild);
    return result;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
function validateSelection() {
  const selections = [
    values.offline,
    values.bundle,
    values.version,
    values.cid,
  ].filter(Boolean);
  if (selections.length > 1)
    throw new Error(
      "Select only one of --offline, --bundle, --version, or --cid.",
    );
  if (values.gateway && !values.cid)
    throw new Error("--gateway requires --cid.");
}
async function launch() {
  validateSelection();
  await mkdir(cache, { recursive: true, mode: 0o700 });
  if (values.cid) return launchCid(values.cid);
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
    const highest = values.version ? "v0.0.0" : await readHighest(cache);
    if (!values.version && compareVersions(release.tag, highest) < 0)
      throw new Error(
        "Release rollback detected. Select an older version explicitly.",
      );
    const privateBuild = !!values["private-build"];
    await promote(release.stage, result.digest, privateBuild);
    await recordVersion(cache, release.tag);
    await selectBundle(cache, result.digest, privateBuild);
    return result;
  } finally {
    await rm(release.stage, { recursive: true, force: true });
  }
}
if (values.help) {
  console.log(
    "freelp [--version vX.Y.Z | --cid RELEASE_CID [--gateway URL] | --offline] [--bundle DIRECTORY] [--private-build] [--no-browser] [--port 4173] [--licenses]\nRequires GitHub CLI for release discovery and public Sigstore verification. Install the initial CLI from an independently verified official source.",
  );
} else if (values.licenses) {
  console.log(
    ownLicense +
      "\n" +
      dependencyNotices +
      "\nBun runtime notices:\n" +
      runtimeNotices,
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
