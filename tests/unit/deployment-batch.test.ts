import { expect, test } from "bun:test";
import {
  prepareAllDeployments,
  verifyDeploymentBatch,
  deploymentAddress,
  DEPLOYMENT_KINDS,
  CREATE2_FACTORY,
  FACTORY_RUNTIME,
} from "../../src/deterministic";
import { expectedRuntime } from "../../src/contractDeployment";
import { DEFAULT_SETTINGS } from "../../src/config";

test("deployment batches skip verified code, preserve dependencies, and reject stale or altered plans without simulation", async () => {
  const codes = new Map<string, string>([
    [CREATE2_FACTORY.toLowerCase(), FACTORY_RUNTIME],
  ]);
  const methods: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      methods.push(body.method);
      const result =
        body.method === "eth_chainId"
          ? "0x1"
          : (codes.get(String(body.params[0]).toLowerCase()) ?? "0x");
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  const settings = { ...DEFAULT_SETTINGS, rpcUrl: server.url.href };
  try {
    const all = await prepareAllDeployments(settings);
    expect(all).toHaveLength(5);
    await verifyDeploymentBatch(settings, all);
    await expect(
      verifyDeploymentBatch(settings, [...all].reverse()),
    ).rejects.toThrow("batch differs");
    await expect(
      verifyDeploymentBatch(settings, [
        { ...all[0], value: 1n },
        ...all.slice(1),
      ]),
    ).rejects.toThrow("batch differs");
    codes.set(
      settings.core.toLowerCase(),
      expectedRuntime("Core", settings.core),
    );
    expect(await prepareAllDeployments(settings)).toEqual(all.slice(1));
    await expect(verifyDeploymentBatch(settings, all)).rejects.toThrow(
      "state changed",
    );
    codes.set(settings.manager.toLowerCase(), "0x6000");
    await expect(prepareAllDeployments(settings)).rejects.toThrow(
      "incompatible code",
    );
    for (const kind of DEPLOYMENT_KINDS)
      codes.set(
        deploymentAddress(kind, settings.core).toLowerCase(),
        expectedRuntime(kind, settings.core),
      );
    expect(await prepareAllDeployments(settings)).toEqual([]);
    expect(new Set(methods)).toEqual(new Set(["eth_chainId", "eth_getCode"]));
  } finally {
    server.stop(true);
  }
});
