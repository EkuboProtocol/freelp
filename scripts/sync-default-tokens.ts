// Refreshes public/tokens/<chainId>.json from the Ekubo API: every token with
// visibility_priority >= 0 on each bundled chain. Only address, symbol, name,
// and decimals are kept; native tokens come from viem at runtime. The app
// fetches these files from its own origin on demand (src/tokenCatalog.ts).
// Usage: bun scripts/sync-default-tokens.ts [--check]
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getAddress, isAddress, zeroAddress } from "viem";
import { chainDefinition } from "../src/chains";

type Bundled = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};
type ApiToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  visibility_priority: number | null;
  sort_order: number | null;
};
const API = process.env.EKUBO_API ?? "https://prod-api.ekubo.org";
const directory = resolve(import.meta.dirname, "../public/tokens");
const check = process.argv.includes("--check");
const minPriority = Number(
  process.argv
    .find((arg) => arg.startsWith("--min-priority="))
    ?.split("=")[1] ?? "0",
);
const current: Record<string, Bundled[]> = {};
for (const name of (await readdir(directory)).sort())
  if (name.endsWith(".json"))
    current[name.slice(0, -5)] = JSON.parse(
      await readFile(resolve(directory, name), "utf8"),
    ) as Bundled[];

function valid(token: ApiToken) {
  return (
    isAddress(token.address) &&
    token.address !== zeroAddress &&
    typeof token.symbol === "string" &&
    token.symbol.trim() !== "" &&
    typeof token.name === "string" &&
    Number.isInteger(token.decimals) &&
    token.decimals >= 0 &&
    token.decimals <= 255
  );
}

async function fetchVisible(chainId: string): Promise<ApiToken[]> {
  const response = await fetch(`${API}/tokens?chainId=${chainId}`);
  if (!response.ok) throw new Error(`${chainId}: HTTP ${response.status}`);
  const tokens = (await response.json()) as ApiToken[];
  if (!Array.isArray(tokens)) throw new Error(`${chainId}: unexpected body`);
  // Ekubo pools use the native currency directly, so its wrapped form is
  // never a default (docs/token-defaults.md).
  const wrapped = `w${chainDefinition(Number(chainId)).nativeCurrency.symbol}`;
  const visible = tokens.filter(
    (token) =>
      (token.visibility_priority ?? -1) >= minPriority &&
      token.symbol?.toLowerCase() !== wrapped.toLowerCase() &&
      !(chainId === "137" && token.symbol === "WMATIC"),
  );
  // The endpoint returns at most 1000 entries and offers no pagination.
  if (tokens.length >= 1000)
    console.warn(`${chainId}: the API capped the list at 1000 tokens`);
  return visible;
}

const next: Record<string, Bundled[]> = {};
const summary: string[] = [];
for (const chainId of Object.keys(current)) {
  const visible = await fetchVisible(chainId);
  const merged = new Map<string, Bundled>();
  for (const token of [...visible].sort(
    (a, b) =>
      (b.visibility_priority ?? 0) - (a.visibility_priority ?? 0) ||
      (b.sort_order ?? 0) - (a.sort_order ?? 0) ||
      a.symbol.localeCompare(b.symbol),
  )) {
    if (!valid(token)) continue;
    merged.set(token.address.toLowerCase(), {
      address: getAddress(token.address),
      symbol: token.symbol.trim().slice(0, 32),
      name: token.name.trim().slice(0, 80),
      decimals: token.decimals,
    });
  }
  let kept = 0;
  for (const token of current[chainId])
    if (!merged.has(token.address.toLowerCase())) {
      merged.set(token.address.toLowerCase(), {
        ...token,
        address: getAddress(token.address),
      });
      kept++;
    }
  next[chainId] = [...merged.values()];
  summary.push(
    `${chainId}: ${visible.length} visible from API, ${kept} bundled-only kept, ${next[chainId].length} total`,
  );
}

let stale = false;
for (const [chainId, tokens] of Object.entries(next)) {
  const path = resolve(directory, `${chainId}.json`);
  const output = JSON.stringify(tokens) + "\n";
  if (check) {
    if (output !== (await readFile(path, "utf8"))) stale = true;
  } else await writeFile(path, output);
}
if (stale) {
  console.error(
    "public/tokens is out of date; run bun scripts/sync-default-tokens.ts",
  );
  process.exit(1);
}
console.log(summary.join("\n"));
