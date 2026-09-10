import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import {
  verifyPrivateProof,
  verifyPublicProof,
  type PrivateProof,
} from "../cli/provenance";
import { sha256 } from "../cli/content";
const [dir, binary, mode] = process.argv.slice(2);
if (!dir || !binary)
  throw new Error(
    "Usage: bun scripts/verify-launcher.ts BUNDLE_DIR BINARY [private]",
  );
const descriptorPath = join(dir, "descriptor.json");
const proofPath = join(dir, "provenance.json");
const descriptor =
  mode === "private"
    ? await verifyPrivateProof(
        await readFile(descriptorPath),
        JSON.parse(await readFile(proofPath, "utf8")) as PrivateProof,
      )
    : await verifyPublicProof(descriptorPath, proofPath);
const expected = descriptor.launchers?.find(
  (entry) => entry.name === basename(binary),
);
const bytes = await readFile(binary);
if (
  !expected ||
  expected.size !== bytes.length ||
  expected.sha256 !== sha256(bytes)
)
  throw new Error("Launcher digest does not match authenticated CI output.");
console.log(
  `Verified launcher from ${descriptor.repository} at ${descriptor.commit}.`,
);
