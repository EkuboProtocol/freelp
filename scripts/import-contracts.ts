import { resolve } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: bun scripts/import-contracts.ts /path/to/evm-contracts",
  );
await mkdir("artifacts", { recursive: true });
for (const name of [
  "Core",
  "FreeLP",
  "TestToken",
  "QuoteDataFetcher",
  "CoreDataFetcher",
  "TokenDataFetcher",
  "FreeLPDataFetcher",
]) {
  const input = JSON.parse(
    await readFile(
      resolve(source, "out", `${name}.sol`, `${name}.json`),
      "utf8",
    ),
  );
  const output = {
    abi: input.abi,
    bytecode: input.bytecode.object,
    deployedBytecode: input.deployedBytecode.object,
    immutableReferences: input.deployedBytecode.immutableReferences ?? {},
    metadata: input.metadata,
  };
  await writeFile(`artifacts/${name}.json`, JSON.stringify(output));
}
