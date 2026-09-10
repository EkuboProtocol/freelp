import { open } from "node:fs/promises";

/** Bound memory even if an untrusted local bundle grows while being read. */
export async function readLimited(path: string, limit: number) {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > limit)
      throw new Error(
        "Bundle file is not a regular file within the size limit.",
      );
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      length += chunk.length;
      if (length > limit)
        throw new Error("Bundle file exceeds the size limit.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
  } finally {
    await file.close();
  }
}
