import { expect, test } from "bun:test";
import {
  chainDefinition,
  chainSettings,
  DEFAULT_CHAIN_IDS,
  MAINNET_CHAINS,
} from "../../src/chains";
import {
  loadNetworks,
  loadNetworkPreferences,
  setNetworkEnabled,
  updateNetworks,
} from "../../src/networks";
import { rpc } from "../../src/rpc";
function storage(run: (store: Map<string, string>) => void) {
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
    run(store);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}
test("fresh preferences enable exactly 11 chains without overriding viem RPCs", () =>
  storage(() => {
    expect(loadNetworkPreferences()).toEqual({
      enabledChainIds: [...DEFAULT_CHAIN_IDS],
      rpcOverrides: {},
    });
    for (const network of loadNetworks()) {
      expect(network.rpcUrl).toBe("");
      expect(rpc(network).transport.url).toBe(
        chainDefinition(network.chainId).rpcUrls.default.http[0],
      );
    }
    expect(MAINNET_CHAINS.some((chain) => chain.testnet)).toBe(false);
    expect(new Set(MAINNET_CHAINS.map((chain) => chain.id)).size).toBe(
      MAINNET_CHAINS.length,
    );
  }));
test("disabled chains remain disabled, including when every chain is off", () =>
  storage(() => {
    let networks = loadNetworks();
    for (const id of DEFAULT_CHAIN_IDS)
      networks = setNetworkEnabled(networks, id, false);
    expect(loadNetworks()).toEqual([]);
    networks = setNetworkEnabled(networks, 43114, true);
    expect(networks.map((chain) => chain.chainId)).toEqual([43114]);
    updateNetworks(networks, chainSettings(43114, "https://example.test/rpc"));
    expect(loadNetworkPreferences().rpcOverrides).toEqual({
      43114: "https://example.test/rpc",
    });
    updateNetworks(loadNetworks(), chainSettings(43114));
    expect(loadNetworkPreferences().rpcOverrides).toEqual({});
  }));
test("migration drops bundled defaults but preserves custom overrides", () =>
  storage((store) => {
    store.set(
      "freelp:networks",
      JSON.stringify([
        chainSettings(1, "https://ethereum-rpc.publicnode.com"),
        chainSettings(8453, "https://custom.example/rpc"),
      ]),
    );
    expect(loadNetworkPreferences().rpcOverrides).toEqual({
      8453: "https://custom.example/rpc",
    });
    expect(loadNetworks().find((chain) => chain.chainId === 1)?.rpcUrl).toBe(
      "",
    );
  }));
