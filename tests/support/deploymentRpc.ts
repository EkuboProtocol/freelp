import { rpcEndpoint } from "../../src/chains";
import type { Page } from "@playwright/test";
import { padHex, toHex, toFunctionSelector } from "viem";
import { NETWORKS } from "../../src/networks";
import { DEFAULT_CONTRACTS } from "../../src/deployments";
import { expectedRuntime } from "../../src/contractDeployment";
import { mockRegistry } from "./registryRpc";
const addresses = {
  Core: DEFAULT_CONTRACTS.core,
  PoolKeyIndex: DEFAULT_CONTRACTS.poolKeyIndex,
  FreeLP: DEFAULT_CONTRACTS.manager,
  FreeLPDataFetcher: DEFAULT_CONTRACTS.freeLPDataFetcher,
};
export async function mockDeployments(
  page: Page,
  missing?: keyof typeof addresses,
) {
  await mockRegistry(page);
  await page.route(
    (url) =>
      NETWORKS.some(
        (network) =>
          rpcEndpoint(network).replace(/\/$/, "") ===
          url.href.replace(/\/$/, ""),
      ),
    async (route) => {
      const body = route.request().postDataJSON();
      const network = NETWORKS.find(
        (network) =>
          rpcEndpoint(network).replace(/\/$/, "") ===
          route.request().url().replace(/\/$/, ""),
      )!;
      const result = deploymentReply(body, network.chainId, missing);
      if (result === undefined) return route.fallback();
      await route.fulfill({ json: { jsonrpc: "2.0", id: body.id, result } });
    },
  );
}
function deploymentReply(
  body: { method: string; params: (string | { data?: string })[] },
  chain: number,
  missing?: keyof typeof addresses,
) {
  if (body.method === "eth_chainId") return toHex(chain);
  if (body.method === "eth_getCode") {
    const kind = (Object.keys(addresses) as (keyof typeof addresses)[]).find(
      (kind) =>
        addresses[kind].toLowerCase() === String(body.params[0]).toLowerCase(),
    );
    if (kind)
      return kind === missing
        ? "0x"
        : expectedRuntime(kind, DEFAULT_CONTRACTS.core);
  }
  if (
    body.method === "eth_call" &&
    typeof body.params[0] === "object" &&
    body.params[0]?.data === toFunctionSelector("CORE()")
  )
    return padHex(DEFAULT_CONTRACTS.core, { size: 32 });
  return undefined;
}
