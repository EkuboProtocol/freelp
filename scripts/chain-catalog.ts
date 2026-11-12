// Writes src/chainCatalog.json from viem's chain list: the names, native
// currencies and default RPCs FreeLP offers. Exact's data module cannot load
// viem/chains itself (some chain modules need workers or the DOM).
// Run after updating viem: bun scripts/chain-catalog.ts
import * as chains from "viem/chains";

export function chainCatalog() {
  const seen = new Set<number>();
  return Object.values(chains)
    .filter((chain) => {
      if (seen.has(chain.id) || !chain.rpcUrls.default.http.length) return false;
      seen.add(chain.id);
      return true;
    })
    .map((chain) => ({
      id: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: { default: { http: [chain.rpcUrls.default.http[0]] } },
      testnet: chain.testnet === true,
    }))
    .sort((a, b) => a.id - b.id);
}

if (import.meta.main)
  await Bun.write(
    new URL("../src/chainCatalog.json", import.meta.url),
    JSON.stringify(chainCatalog()) + "\n",
  );
