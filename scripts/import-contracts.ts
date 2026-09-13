import { resolve } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { immutableNames, bindImmutables } from "./artifact-immutables";
import {
  verifySourceCheckout,
  verifyArtifactSources,
} from "./verify-contract-inputs";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: bun scripts/import-contracts.ts /path/to/evm-contracts [compiled-output-directory]",
  );
verifySourceCheckout(source);
const artifactDirectory = process.argv[3] ?? resolve(source, "out");
const baseAsts = await Promise.all(
  ["BaseLocker", "UsesCore"].map(
    async (name) =>
      JSON.parse(
        await readFile(
          resolve(artifactDirectory, `${name}.sol`, `${name}.json`),
          "utf8",
        ),
      ).ast,
  ),
);
const outputs: { name: string; output: unknown }[] = [];
for (const name of [
  "Core",
  "FreeLP",
  "TestToken",
  "FreeLPDataFetcher",
  "PoolKeyIndex",
]) {
  const input = JSON.parse(
    await readFile(
      resolve(artifactDirectory, `${name}.sol`, `${name}.json`),
      "utf8",
    ),
  );
  const metadata =
    typeof input.metadata === "string"
      ? JSON.parse(input.metadata)
      : input.metadata;
  await verifyArtifactSources(source, metadata);
  const output = {
    abi: input.abi,
    bytecode: input.bytecode.object,
    deployedBytecode: input.deployedBytecode.object,
    immutableReferences: input.deployedBytecode.immutableReferences ?? {},
    immutableBindings: bindImmutables(
      input.deployedBytecode.immutableReferences ?? {},
      immutableNames([input.ast, ...baseAsts].filter(Boolean)),
    ),
    metadata,
  };
  outputs.push({ name, output });
}
// Validate every input before replacing any committed artifact.
await mkdir("artifacts", { recursive: true });
for (const { name, output } of outputs)
  await writeFile(`artifacts/${name}.json`, JSON.stringify(output));
