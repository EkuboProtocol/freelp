import { padHex, type Address, type Hex } from "viem";
export type RuntimeArtifact = {
  deployedBytecode: string;
  immutableReferences: Record<string, { start: number; length: number }[]>;
};
export function expectedRuntime(artifact: RuntimeArtifact, core: Address): Hex {
  const bytes = artifact.deployedBytecode.slice(2).split("");
  for (const ranges of Object.values(artifact.immutableReferences))
    for (const { start, length } of ranges) {
      if (length !== 32) throw new Error("Unexpected immutable encoding.");
      const value = padHex(core, { size: 32 }).slice(2);
      bytes.splice(start * 2, length * 2, ...value);
    }
  return `0x${bytes.join("")}` as Hex;
}
export function assertRuntime(
  artifact: RuntimeArtifact,
  code: Hex,
  core: Address,
) {
  if (code.toLowerCase() !== expectedRuntime(artifact, core).toLowerCase())
    throw new Error(
      "Contract code or immutable Core/accountant binding does not match this build.",
    );
}
