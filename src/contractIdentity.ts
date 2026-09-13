import type { Address, Hex } from "viem";
import { expectedRuntime } from "./contractDeployment";
import type { ContractKind } from "./contracts";

export class ContractIdentityError extends Error {
  constructor(
    public readonly state: "missing" | "incompatible",
    kind: ContractKind,
  ) {
    super(
      state === "missing"
        ? `${kind} is not deployed at this address.`
        : `${kind} has incompatible code at this build’s fixed address. Do not deposit on this network.`,
    );
  }
}

export function assertContractRuntime(
  kind: ContractKind,
  core: Address,
  code?: Hex,
) {
  if (!code || code === "0x") throw new ContractIdentityError("missing", kind);
  if (code.toLowerCase() !== expectedRuntime(kind, core))
    throw new ContractIdentityError("incompatible", kind);
}
