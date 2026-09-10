import { createHash } from "node:crypto";
import { importer } from "ipfs-unixfs-importer";
import { MemoryBlockstore } from "blockstore-core/memory";
import { fixedSize } from "ipfs-unixfs-importer/chunker";
import { balanced } from "ipfs-unixfs-importer/layout";
export const MAX_BYTES = 32 * 1024 * 1024;
export const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export type FileEntry = { path: string; content: string };
export function safePath(path: string) {
  return (
    path.length < 240 &&
    /^[a-zA-Z0-9_./-]+$/.test(path) &&
    !path.startsWith("/") &&
    path.split("/").every((p) => p !== "" && p !== "." && p !== "..")
  );
}
function decodeEntry(entry: FileEntry, files: Map<string, Uint8Array>) {
  if (
    !safePath(entry.path) ||
    files.has(entry.path) ||
    typeof entry.content !== "string"
  )
    throw new Error("Invalid application path.");
  const content = Buffer.from(entry.content, "base64");
  if (content.toString("base64") !== entry.content)
    throw new Error("Noncanonical file encoding.");
  return content;
}
export function decodeApplication(bytes: Uint8Array) {
  if (bytes.length > MAX_BYTES) throw new Error("Application is too large.");
  const entries: FileEntry[] = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(entries) || entries.length > 2000)
    throw new Error("Invalid file list.");
  const files = new Map<string, Uint8Array>();
  let size = 0;
  for (const entry of entries) {
    const content = decodeEntry(entry, files);
    size += content.length;
    if (size > MAX_BYTES) throw new Error("Application is too large.");
    files.set(entry.path, content);
  }
  if (!files.has("index.html")) throw new Error("Missing index.html.");
  return files;
}
export async function contentDag(files: Map<string, Uint8Array>) {
  const blockstore = new MemoryBlockstore();
  let root;
  const source = [...files]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, content]) => ({ path, content }));
  for await (const entry of importer(source, blockstore, {
    cidVersion: 1,
    rawLeaves: true,
    wrapWithDirectory: true,
    chunker: fixedSize({ chunkSize: 262144 }),
    layout: balanced({ maxChildrenPerNode: 174 }),
  }))
    root = entry.cid;
  if (!root) throw new Error("No IPFS root.");
  return { root, blockstore };
}
export type ReleaseDescriptor = {
  schema: 1;
  repository: string;
  commit: string;
  ref: string;
  siteCid: string;
  applicationSha256: string;
  files: { path: string; sha256: string; size: number }[];
  launchers?: { name: string; sha256: string; size: number }[];
};
export async function verifyApplication(
  bytes: Uint8Array,
  descriptor: ReleaseDescriptor,
) {
  if (sha256(bytes) !== descriptor.applicationSha256)
    throw new Error("Application digest mismatch.");
  const files = decodeApplication(bytes);
  if (files.size !== descriptor.files.length)
    throw new Error("Manifest length mismatch.");
  for (const entry of descriptor.files) {
    const data = files.get(entry.path);
    if (!data || data.length !== entry.size || sha256(data) !== entry.sha256)
      throw new Error("File digest mismatch.");
  }
  const { root } = await contentDag(files);
  if (root.toString() !== descriptor.siteCid)
    throw new Error("IPFS CID mismatch.");
  return files;
}
