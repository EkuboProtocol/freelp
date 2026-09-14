import { expect, test } from "bun:test";
import { chainSettings } from "../../src/chains";
import { expectedRuntime } from "../../src/contractDeployment";
import {
  DEFAULT_MANAGER,
  DEFAULT_POSITION_DATA_FETCHER,
} from "../../src/deployments";
import {
  forgetVerification,
  isVerified,
  rememberVerification,
  requiredContracts,
  verifyNetworkDeployment,
} from "../../src/networkVerification";

async function storage<T>(run: (store: Map<string, string>) => Promise<T>) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  try {
    return await run(store);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

function verifiedNetworks(store: Map<string, string>) {
  return JSON.parse(store.get("freelp:verifiedNetworks") ?? "{}");
}

test("enable checks read the chain ID and each contract once, caching only success", () =>
  storage(async (store) => {
    const settings = chainSettings(8453);
    const codes = new Map<string, string>();
    let chain = "0x2105";
    const methods: string[] = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const body = await request.json();
        methods.push(body.method);
        const result =
          body.method === "eth_chainId"
            ? chain
            : (codes.get(String(body.params[0]).toLowerCase()) ?? "0x");
        return Response.json({ jsonrpc: "2.0", id: body.id, result });
      },
    });
    const network = { ...settings, rpcUrl: server.url.href };
    try {
      expect(await verifyNetworkDeployment(network)).toMatchObject({
        state: "missing",
      });
      expect(methods).toEqual(["eth_chainId", ...Array(5).fill("eth_getCode")]);
      expect(isVerified(8453)).toBe(false);
      expect(store.has("freelp:verifiedNetworks")).toBe(false);

      for (const [kind, address] of requiredContracts(network))
        codes.set(address.toLowerCase(), expectedRuntime(kind, network.core));
      expect(await verifyNetworkDeployment(network)).toEqual({
        state: "ready",
        issues: [],
      });
      expect(isVerified(8453)).toBe(true);
      expect(verifiedNetworks(store)).toEqual({
        8453: {
          manager: DEFAULT_MANAGER,
          fetcher: DEFAULT_POSITION_DATA_FETCHER,
        },
      });

      codes.set(network.manager.toLowerCase(), "0x6000");
      const mismatched = await verifyNetworkDeployment(network);
      expect(mismatched.state).toBe("mismatched");
      expect(mismatched.issues.map((issue) => issue.kind)).toEqual(["FreeLP"]);
      expect(mismatched.issues[0].message).toContain("incompatible code");
      expect(isVerified(8453)).toBe(false);

      codes.delete(network.manager.toLowerCase());
      const missing = await verifyNetworkDeployment(network);
      expect(missing).toMatchObject({ state: "missing" });
      expect(missing.issues[0].message).toBe(
        "FreeLP: FreeLP is not deployed at this address.",
      );

      chain = "0x1";
      const wrongChain = await verifyNetworkDeployment(network);
      expect(wrongChain.state).toBe("unreachable");
      expect(wrongChain.issues[0].message).toBe(
        "Expected chain 8453, but this RPC reports 1.",
      );
    } finally {
      await server.stop(true);
    }
    const unreachable = await verifyNetworkDeployment({
      ...network,
      rpcUrl: "http://127.0.0.1:1/",
    });
    expect(unreachable.state).toBe("unreachable");
    expect(isVerified(8453)).toBe(false);
  }));

test("cached verification is scoped to this build's contract addresses", () =>
  storage(async (store) => {
    rememberVerification(1);
    expect(isVerified(1)).toBe(true);
    expect(isVerified(10)).toBe(false);
    store.set(
      "freelp:verifiedNetworks",
      JSON.stringify({
        1: {
          manager: "0x0000000000000000000000000000000000000001",
          fetcher: "",
        },
        10: {
          manager: DEFAULT_MANAGER,
          fetcher: DEFAULT_POSITION_DATA_FETCHER,
        },
      }),
    );
    expect(isVerified(1)).toBe(false);
    expect(isVerified(10)).toBe(true);
    forgetVerification(10);
    expect(isVerified(10)).toBe(false);
    store.set("freelp:verifiedNetworks", JSON.stringify([1, 10]));
    expect(isVerified(1)).toBe(false);
  }));
