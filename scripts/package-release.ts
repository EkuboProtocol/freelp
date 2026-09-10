import { readdir, readFile, writeFile, mkdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { writeCar } from "./car";
import {
  contentDag,
  sha256,
  type FileEntry,
  type ReleaseDescriptor,
} from "../cli/content";
const REPOSITORY = "EkuboProtocol/freelp";
async function collect(dir: string, prefix = ""): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  for (const name of (await readdir(dir)).sort()) {
    const path = join(dir, name),
      relative = prefix + name;
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error("Symlinks forbidden.");
    if (stat.isDirectory())
      entries.push(...(await collect(path, relative + "/")));
    else if (stat.isFile())
      entries.push({
        path: relative,
        content: (await readFile(path)).toString("base64"),
      });
  }
  return entries;
}
const files = await collect("dist");
const application = JSON.stringify(files);
const map = new Map(
  files.map((f) => [f.path, Buffer.from(f.content, "base64")]),
);
const { root, blockstore } = await contentDag(map);
const commit = process.env.GITHUB_SHA ?? process.argv[2];
if (!commit || !/^[a-f0-9]{40}$/.test(commit))
  throw new Error("Supply a source commit SHA.");
const descriptor: ReleaseDescriptor = {
  schema: 1,
  repository: REPOSITORY,
  commit,
  ref: process.env.GITHUB_REF ?? "refs/heads/main",
  siteCid: root.toString(),
  applicationSha256: sha256(application),
  files: [...map].map(([path, bytes]) => ({
    path,
    sha256: sha256(bytes),
    size: bytes.length,
  })),
};
await mkdir("release", { recursive: true });
await writeFile("release/application.json", application);
await writeFile("release/descriptor.json", JSON.stringify(descriptor));
await writeCar("release/site.car", { root, blockstore });
console.log(`Application CID: ${root}`);

await writeFile(
  "release/deployment.json",
  JSON.stringify({ repository: REPOSITORY, commit, siteCid: root.toString() }),
);
