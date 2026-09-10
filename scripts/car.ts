import { writeFile } from "node:fs/promises";
import { CarWriter } from "@ipld/car";
import type { contentDag } from "../cli/content";

export async function writeCar(
  path: string,
  dag: Awaited<ReturnType<typeof contentDag>>,
) {
  const { writer, out } = CarWriter.create([dag.root]);
  const output = (async () => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of out) chunks.push(chunk);
    await writeFile(path, Buffer.concat(chunks));
  })();
  for await (const block of dag.blockstore.getAll()) {
    const chunks: Uint8Array[] = [];
    for await (const bytes of block.bytes) chunks.push(bytes);
    await writer.put({ cid: block.cid, bytes: Buffer.concat(chunks) });
  }
  await writer.close();
  await output;
}
