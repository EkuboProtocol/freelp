import { test, expect } from "@playwright/test";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  zeroAddress,
} from "viem";
import { foundry } from "viem/chains";
import {
  CREATE2_FACTORY,
  FACTORY_RUNTIME,
  deploymentAddress,
  prepareDeployment,
} from "../../src/deterministic";
import {
  DEFAULT_CONTRACTS,
  DEFAULT_METADATA_RENDERER,
} from "../../src/deployments";
import { verifyCode } from "../../src/contracts";
const rpcUrl = "http://127.0.0.1:18545";
const node = createTestClient({
  mode: "anvil",
  chain: foundry,
  transport: http(rpcUrl),
});
const client = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
const wallets = createWalletClient({ chain: foundry, transport: http(rpcUrl) });
const settings = {
  ...DEFAULT_CONTRACTS,
  chainId: 31337,
  rpcUrl,
  nativeSymbol: "ETH",
};

test("CREATE2 addresses are shared across accounts and occupied addresses cannot be redeployed", async () => {
  await node.request({ method: "anvil_reset", params: [] });
  await node.setCode({ address: CREATE2_FACTORY, bytecode: FACTORY_RUNTIME });
  const accounts = await wallets.getAddresses();
  for (const [kind, account] of [
    ["Core", accounts[0]],
    ["PoolKeyIndex", accounts[1]],
    ["FreeLPMetadataRenderer", accounts[1]],
    ["FreeLP", accounts[2]],
  ] as const) {
    const tx = await prepareDeployment(settings, kind);
    const hash = await wallets.sendTransaction({ ...tx, account });
    expect((await client.waitForTransactionReceipt({ hash })).status).toBe(
      "success",
    );
    const address = deploymentAddress(kind, settings.core);
    expect(address).toBe(
      kind === "Core"
        ? DEFAULT_CONTRACTS.core
        : kind === "PoolKeyIndex"
          ? DEFAULT_CONTRACTS.poolKeyIndex
          : kind === "FreeLPMetadataRenderer"
            ? DEFAULT_METADATA_RENDERER
            : DEFAULT_CONTRACTS.manager,
    );
    await verifyCode(settings, address, kind);
    await expect(prepareDeployment(settings, kind)).rejects.toThrow(
      "already deployed",
    );
  }
  await node.setCode({ address: settings.manager, bytecode: "0x6000" });
  await expect(prepareDeployment(settings, "FreeLP")).rejects.toThrow(
    "incompatible code",
  );
  await node.setCode({ address: CREATE2_FACTORY, bytecode: "0x" });
  await expect(
    prepareDeployment(settings, "FreeLPDataFetcher"),
  ).rejects.toThrow("factory is missing");
  await expect(
    prepareDeployment({ ...settings, chainId: 1 }, "FreeLPDataFetcher"),
  ).rejects.toThrow("RPC chain");
  expect(deploymentAddress("FreeLP", zeroAddress)).not.toBe(settings.manager);
});
