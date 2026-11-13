import {
  encodeDeployData,
  keccak256,
  padHex,
  toBytes,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import digests from "../artifacts/digests.json" with { type: "json" };
import {
  DEFAULT_POOL_KEY_INDEX,
  DEFAULT_METADATA_RENDERER,
} from "./deployments";
import type { ContractKind } from "./contracts";

type Artifact = {
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
  immutableReferences: Record<string, { start: number; length: number }[]>;
  immutableBindings: Record<string, string>;
};
export type ArtifactFetch = (path: string) => Promise<string>;

// Creation and runtime code are only needed to deploy or to check a
// network's contracts, so they stay out of the first download: the site
// carries the artifacts, and each is checked against this build's digest.
const CONTRACT_ARTIFACTS: Partial<Record<ContractKind, Artifact>> = {};
let fetchArtifact: ArtifactFetch | undefined;
let loading: Promise<void> | undefined;

export function setArtifactFetch(next: ArtifactFetch) {
  fetchArtifact = next;
}

export function loadArtifacts() {
  return (loading ??= Promise.all(
    (Object.keys(digests) as ContractKind[]).map(async (kind) => {
      if (!fetchArtifact)
        throw new Error("This build's contract artifacts are unavailable.");
      const text = await fetchArtifact(`artifacts/${kind}.json`);
      if (keccak256(toBytes(text)) !== digests[kind])
        throw new Error(`${kind} artifact does not match this build.`);
      CONTRACT_ARTIFACTS[kind] = JSON.parse(text) as Artifact;
    }),
  ).then(
    () => {},
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  ));
}

function artifactOf(kind: ContractKind) {
  const artifact = CONTRACT_ARTIFACTS[kind];
  if (!artifact) throw new Error("Contract artifacts have not loaded yet.");
  return artifact;
}

export function deployment(kind: ContractKind, core: Address) {
  const artifact = artifactOf(kind);
  return encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs(kind, core),
  });
}

function constructorArgs(kind: ContractKind, core: Address) {
  if (kind === "Core" || kind === "FreeLPMetadataRenderer") return [];
  return kind === "FreeLP"
    ? [core, DEFAULT_POOL_KEY_INDEX, DEFAULT_METADATA_RENDERER]
    : [core];
}

export function expectedRuntime(kind: ContractKind, core: Address): Hex {
  const artifact = artifactOf(kind);
  let runtime = artifact.deployedBytecode.toLowerCase();
  const bindings = artifact.immutableBindings;
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
  const values: Record<string, Address> = {
    core,
    poolKeyIndex: DEFAULT_POOL_KEY_INDEX,
    metadataRenderer: DEFAULT_METADATA_RENDERER,
  };
  if (!Object.hasOwn(values, binding))
    throw new Error("Unrecognized immutable binding in bundled artifact.");
  return padHex(values[binding], {
    size: 32,
  })
    .slice(2)
    .toLowerCase();
}
