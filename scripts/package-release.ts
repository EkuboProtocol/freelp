import { readdir, readFile, writeFile, mkdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { CarWriter } from "@ipld/car";
import {
  contentDag,
  sha256,
  type FileEntry,
  type ReleaseDescriptor,
} from "../cli/content";
import { REPOSITORY } from "../cli/provenance";
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
const launchers = [];
for (const name of ["freelp-linux-x64", "freelp-darwin-arm64"]) {
  try {
    const bytes = await readFile(`release/${name}`);
    launchers.push({ name, sha256: sha256(bytes), size: bytes.length });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const descriptor: ReleaseDescriptor = {
  schema: 1,
  launchers,
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
const { writer, out } = CarWriter.create([root]);
const output = (async () => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of out) chunks.push(chunk);
  await writeFile("release/site.car", Buffer.concat(chunks));
})();
for await (const block of blockstore.getAll()) {
  const chunks: Uint8Array[] = [];
  for await (const bytes of block.bytes) chunks.push(bytes);
  await writer.put({ cid: block.cid, bytes: Buffer.concat(chunks) });
}
await writer.close();
await output;
console.log(`Application CID: ${root}`);
