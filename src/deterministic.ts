import { deployment } from "./contractDeployment";
import { assertContractRuntime } from "./contractIdentity";
import { concatHex, getCreate2Address, type Address } from "viem";
import { verifyCode, type ContractKind } from "./contracts";
import { rpc } from "./rpc";
import { DEFAULT_POOL_KEY_INDEX } from "./deployments";
import type { Settings, Transaction } from "./types";

// EkuboProtocol/evm-contracts script/DeployAll.s.sol. Never derive from an account.
export const DEPLOYMENT_SALT =
  "0x28f4114b40904ad1cfbb42175a55ad64187c1b299773bd6318baa292375cf0dd";
export const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
export const FACTORY_RUNTIME =
  "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";
export function deploymentAddress(kind: ContractKind, core: Address) {
  return getCreate2Address({
    from: CREATE2_FACTORY,
    salt: DEPLOYMENT_SALT,
    bytecode: deployment(kind, core),
  });
}
export async function deploymentStatus(settings: Settings, kind: ContractKind) {
  const address = deploymentAddress(kind, settings.core);
  const client = rpc(settings);
  const [chainId, code] = await Promise.all([
    client.getChainId(),
    client.getCode({ address }),
  ]);
  if (chainId !== settings.chainId)
    throw new Error("RPC chain does not match the selected network.");
  if (!code || code === "0x") return { address, exists: false };
  assertContractRuntime(kind, settings.core, code);
  return { address, exists: true };
}
export async function prepareDeployment(
  settings: Settings,
  kind: ContractKind,
): Promise<Transaction> {
  const client = rpc(settings);
  if ((await client.getChainId()) !== settings.chainId)
    throw new Error("RPC chain does not match the selected network.");
  if ((await deploymentStatus(settings, kind)).exists)
    throw new Error(
      "This contract is already deployed. Use the existing address.",
    );
  if (
    (await client.getCode({ address: CREATE2_FACTORY }))?.toLowerCase() !==
    FACTORY_RUNTIME
  )
    throw new Error(
      "The standard CREATE2 factory is missing or has unexpected code on this network.",
    );
  if (kind !== "Core") await verifyCode(settings, settings.core, "Core");
  if (kind === "FreeLP")
    await verifyCode(settings, DEFAULT_POOL_KEY_INDEX, "PoolKeyIndex");
  return {
    to: CREATE2_FACTORY,
    data: concatHex([DEPLOYMENT_SALT, deployment(kind, settings.core)]),
  };
}

export async function verifyDeploymentTransaction(
  settings: Settings,
  tx: Transaction,
) {
  const kinds = [
    "Core",
    "PoolKeyIndex",
    "FreeLP",
    "FreeLPDataFetcher",
  ] as const;
  const kind = kinds.find(
    (kind) =>
      concatHex([
        DEPLOYMENT_SALT,
        deployment(kind, settings.core),
      ]).toLowerCase() === tx.data.toLowerCase(),
  );
  if (!kind || (tx.value ?? 0n) !== 0n)
    throw new Error(
      "Deployment must use this build's fixed salt and constructor arguments.",
    );
  await prepareDeployment(settings, kind);
}
