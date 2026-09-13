import {
  encodeDeployData,
  padHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import coreArtifact from "../artifacts/Core.json" with { type: "json" };
import managerArtifact from "../artifacts/FreeLP.json" with { type: "json" };
import snapshotArtifact from "../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import indexArtifact from "../artifacts/PoolKeyIndex.json" with { type: "json" };
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";
import type { ContractKind } from "./contracts";
const CONTRACT_ARTIFACTS = {
  Core: coreArtifact,
  FreeLP: managerArtifact,
  FreeLPDataFetcher: snapshotArtifact,
  PoolKeyIndex: indexArtifact,
};
export function deployment(kind: ContractKind, core: Address) {
  const artifact = CONTRACT_ARTIFACTS[kind];
  return encodeDeployData({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode as Hex,
    args: constructorArgs(kind, core),
  });
}

function constructorArgs(kind: ContractKind, core: Address) {
  if (kind === "Core") return [];
  return kind === "FreeLP" ? [core, DEFAULT_POOL_KEY_INDEX] : [core];
}

/** Bind AST-identified immutable roles, including the shared registry. */
export function expectedRuntime(kind: ContractKind, core: Address): Hex {
  const artifact = CONTRACT_ARTIFACTS[kind];
  let runtime = artifact.deployedBytecode.toLowerCase();
  const bindings = artifact.immutableBindings as Record<string, string>;
  for (const [id, offsets] of Object.entries(artifact.immutableReferences)) {
    const value = immutableValue(bindings[id], core);
    for (const { start, length } of offsets) {
      if (
        length !== 32 ||
        start < 0 ||
        2 + (start + length) * 2 > runtime.length
      )
        throw new Error("Invalid immutable reference in bundled artifact.");
      const offset = 2 + start * 2;
      runtime = runtime.slice(0, offset) + value + runtime.slice(offset + 64);
    }
  }
  return runtime as Hex;
}

function immutableValue(binding: string, core: Address) {
  if (binding !== "core" && binding !== "poolKeyIndex")
    throw new Error("Unrecognized immutable binding in bundled artifact.");
  return padHex(binding === "core" ? core : DEFAULT_POOL_KEY_INDEX, {
    size: 32,
  })
    .slice(2)
    .toLowerCase();
}
