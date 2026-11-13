import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { artifactDerivatives } from "../../scripts/artifact-derivatives";

test("bundled ABIs and artifact digests match the imported artifacts", async () => {
  for (const [path, text] of Object.entries(await artifactDerivatives()))
    expect(await readFile(path, "utf8")).toBe(text);
});
