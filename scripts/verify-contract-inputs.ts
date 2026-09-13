import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { keccak256, toHex } from "viem";
import provenance from "../artifacts/source.json";

type Metadata = {
  compiler: { version: string };
  settings: {
    evmVersion: string;
    viaIR: boolean;
    optimizer: { enabled: boolean; runs: number };
  };
  sources: Record<string, { keccak256: string }>;
};

export function verifySourceCheckout(source: string) {
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
  if (git("rev-parse", "HEAD") !== provenance.commit)
    throw new Error(
      "Contract checkout must match artifacts/source.json. Review and update the pin before importing.",
    );
  if (git("status", "--porcelain", "--untracked-files=no"))
    throw new Error(
      "Contract checkout has tracked modifications. Import only clean pinned source.",
    );
}

export function verifyCompiler(metadata: Metadata) {
  const { compiler, settings } = metadata;
  if (
    compiler.version.split("+")[0] !== provenance.compiler ||
    settings.evmVersion !== provenance.evmVersion
  )
    throw new Error(
      "Artifact compiler/EVM version differs from artifacts/source.json.",
    );
  if (
    !settings.optimizer.enabled ||
    settings.optimizer.runs !== provenance.optimizerRuns ||
    settings.viaIR !== provenance.viaIR
  )
    throw new Error(
      "Artifact compiler optimization differs from artifacts/source.json.",
    );
}

export async function verifyArtifactSources(
  source: string,
  metadata: Metadata,
) {
  verifyCompiler(metadata);
  for (const [path, entry] of Object.entries(metadata.sources)) {
    const bytes = await readFile(resolve(source, path));
    if (keccak256(toHex(bytes)) !== entry.keccak256)
      throw new Error(
        `Compiled artifact is stale: source hash mismatch for ${path}. Rebuild pinned contracts.`,
      );
  }
}
