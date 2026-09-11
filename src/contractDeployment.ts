import { encodeDeployData, type Abi, type Address, type Hex } from "viem";
import coreArtifact from "../artifacts/Core.json" with { type: "json" };
import managerArtifact from "../artifacts/FreeLP.json" with { type: "json" };
import snapshotArtifact from "../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import type { ContractKind } from "./contracts";
const CONTRACT_ARTIFACTS = {
  Core: coreArtifact,
  FreeLP: managerArtifact,
  FreeLPDataFetcher: snapshotArtifact,
};
export function deployment(kind: ContractKind, core: Address) {
  const artifact = CONTRACT_ARTIFACTS[kind];
  return encodeDeployData({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode as Hex,
    args: kind === "Core" ? [] : [core],
  });
}
