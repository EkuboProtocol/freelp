import { fixedSqrtRatioToFloat, toSqrtRatio } from "@ekubo/sdk";
import { formatUnits, getAddress, isAddress, zeroAddress, type Address } from "viem";
import { readCreateForm, type CreateForm } from "../createForm";
import { snapCreateForm, snapNumber, snapPrice } from "../snapCreateForm";
import { DEFAULT_SETTINGS, loadSettings } from "../config";
import { configuredNetwork, loadNetworks, networkName } from "../networks";
import { networkCurrencies, importCurrency, type Currency } from "../tokens";
import { loadTokenCatalog } from "../tokenCatalog";
import { ready } from "../page";
import { save } from "../storage";
import { errorMessage } from "../errors";
import { verifyNetworkDeployment } from "../networkVerification";
import { readRegistryPage, PAGE_SIZE, type RegisteredPool, type RegistrySnapshot } from "../poolRegistry";
import { fetchPools, poolInitialized } from "../poolData";
import { poolConfig, poolRange, stableBounds } from "../poolOptions";
import { exactFeeFromPercent, percentFromExactFee } from "../fee";
import { decimalDisplay, decimalInput } from "../decimalFormat";
import { checkSpacing, percentToSpacing, spacingPercent } from "../pools";
import { MAX_TICK, displayPrice, priceToTick, rangeTicks, sqrtPrice, tickPrice } from "../prices";
import { liquidityBuckets } from "../liquidityBuckets";
import { calculateDepositQuote } from "../calculateDepositQuote";
import { createDepositTransaction } from "../depositTransaction";
import { minimumLiquidity } from "../positionReview";
import { depositCalls, supportsCalls } from "../walletCalls";
import { tokenBalances, tokenSnapshot } from "../balances";
import { readTokenMetadata } from "../readTokenMetadata";
import { approval, type Token } from "../contracts";
import { parseAmount } from "../amounts";
import { displayAmount } from "../displayAmount";
import { walletProvider } from "../page";
import { balanceView, nativeMax, NO_BALANCE } from "./balances";
import { connectedAccount, execute, type TxReply } from "./tx";
import type { QuoteDataFetcherResult } from "../quoteData";
import type { Settings } from "../types";

// The Create position screen's data. Contract keeps the form in the URL
// (`#/create?…`) and hands the route here; every source reads it again.

type Reply = { ok: boolean; error: string };
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function activeSettings() {
  const networks = loadNetworks();
  return (
    networks.find((network) => network.chainId === loadSettings().chainId) ??
    networks[0] ??
    DEFAULT_SETTINGS
  );
}

// The form the route names, and the network it is scoped to.
async function scope(route: string) {
  await ready();
  const form = readCreateForm(`#${route}`, activeSettings().chainId);
  const network = loadNetworks().find((n) => n.chainId === form.chain);
  if (network) await loadTokenCatalog(network.chainId);
  return { form, network };
}

function snapped(form: CreateForm, settings: Settings): CreateForm {
  return snapCreateForm(form, networkCurrencies(settings)) as CreateForm;
}

// --- The page frame: networks and the token list -------------------------

export async function createSetup() {
  await ready();
  return {
    active: activeSettings().chainId,
    networks: loadNetworks().map((n) => ({
      id: n.chainId,
      name: networkName(n.chainId, n.name),
    })),
  };
}

export async function selectNetwork(chain: number): Promise<Reply> {
  await ready();
  const next = loadNetworks().find((n) => n.chainId === chain);
  if (next && next.chainId !== loadSettings().chainId)
    save("freelp:settings", next);
  return { ok: true, error: "" };
}

function tokenRow(token: Currency, settings: Settings) {
  return {
    key: token.address.toLowerCase(),
    address: token.address as string,
    symbol: token.symbol,
    name: token.name,
    network: networkName(settings.chainId, settings.name),
    short: short(token.address),
    imported: token.source === "imported",
  };
}

export async function createTokens(chain: number) {
  await ready();
  const network = loadNetworks().find((n) => n.chainId === chain);
  if (!network) return { loaded: true, enabled: false, network: "", rows: [] };
  await loadTokenCatalog(chain);
  return {
    loaded: true,
    enabled: true,
    network: networkName(network.chainId, network.name),
    rows: networkCurrencies(network).map((token) => tokenRow(token, network)),
  };
}

// The picker's balances: one batched read on the selected network.
export async function pickerBalances(chain: number, refresh: number) {
  const account = await connectedAccount();
  const network = loadNetworks().find((n) => n.chainId === chain);
  if (!account || !network)
    return { connected: !!account, failed: false, held: [], rows: [] };
  await loadTokenCatalog(chain);
  const tokens = networkCurrencies(network);
  try {
    const balances = await tokenBalances(
      network,
      account,
      tokens.map((t) => t.address),
      refresh,
      0,
    );
    const rows = tokens.map((token) => {
      const balance = balances.get(token.address.toLowerCase()) ?? 0n;
      return {
        key: token.address.toLowerCase(),
        display: displayAmount(balance, token.decimals),
        exact: formatUnits(balance, token.decimals),
      };
    });
    return {
      connected: true,
      failed: false,
      held: tokens
        .filter((t) => (balances.get(t.address.toLowerCase()) ?? 0n) > 0n)
        .map((t) => t.address.toLowerCase()),
      rows,
    };
  } catch {
    return { connected: true, failed: true, held: [], rows: [] };
  }
}

export async function readToken(chain: number, address: string) {
  await ready();
  try {
    const token = await readTokenMetadata(configuredNetwork(chain), address);
    return {
      ok: true,
      error: "",
      address: token.address as string,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error), address: "", symbol: "", name: "", decimals: 0 };
  }
}

export async function importToken(
  chain: number,
  address: string,
  symbol: string,
  name: string,
  decimals: number,
) {
  await ready();
  try {
    const token = importCurrency(chain, {
      address: getAddress(address),
      symbol,
      name,
      decimals,
      source: "onchain",
    });
    return { ok: true, error: "", address: token.address as string };
  } catch (error) {
    return { ok: false, error: errorMessage(error), address: "" };
  }
}

// --- Deployment gate -----------------------------------------------------

export async function createGate(chain: number) {
  await ready();
  const check = await verifyNetworkDeployment(configuredNetwork(chain));
  return {
    state: check.state,
    issues: check.issues.map((issue) => ({ kind: issue.kind as string, message: issue.message })),
  };
}

// --- Registered pools ----------------------------------------------------

type RegistryState = { pools: RegisteredPool[]; scanned: bigint; snapshot?: RegistrySnapshot };
const registries = new Map<string, Promise<RegistryState>>();

function poolCard(pool: RegisteredPool) {
  const fee = pool.fee.toString();
  const stable = pool.stableswapParams;
  return {
    id: pool.id as string,
    config: pool.key.config.toLowerCase(),
    title: `${decimalDisplay(Number(percentFromExactFee(fee)))}% fee`,
    detail:
      pool.poolType === "concentrated"
        ? `Concentrated, spacing ${decimalDisplay(spacingPercent(pool.tickSpacing ?? 0), 3)}%`
        : `${pool.poolType === "full_range" ? "Full-range" : "Stableswap"}, center ${stable?.centerTick}, amplification ${stable?.amplification}`,
    extensionLabel: pool.extension === zeroAddress ? "No extension" : `Extension: ${pool.extension}`,
    exactFee: fee,
    fee: percentFromExactFee(fee),
    extension: pool.extension as string,
    kind: pool.poolType === "concentrated" ? "concentrated" : "stable",
    spacing: pool.tickSpacing ?? 0,
    center: String(stable?.centerTick ?? 0),
    amplification: String(stable?.amplification ?? 0),
  };
}

async function registryPages(settings: Settings, a: Address, b: Address, identity: string, pages: number) {
  const cached = registries.get(`${identity}:${pages}`);
  if (cached) return cached;
  const load = (async (): Promise<RegistryState> => {
    const previous: RegistryState =
      pages > 1 ? await registryPages(settings, a, b, identity, pages - 1) : { pools: [], scanned: 0n };
    if (pages > 1 && previous.snapshot && previous.scanned >= previous.snapshot.total) return previous;
    const page = await readRegistryPage(settings, a, b, previous.scanned, undefined, previous.snapshot);
    const pools = [
      ...new Map([...previous.pools, ...page.pools].map((pool) => [pool.id.toLowerCase(), pool])).values(),
    ];
    return { pools, scanned: page.scanned, snapshot: page.snapshot };
  })();
  registries.set(`${identity}:${pages}`, load);
  load.catch(() => registries.delete(`${identity}:${pages}`));
  return load;
}

export async function createRegistry(chain: number, a: string, b: string, revision: number, retry: number, pages: number) {
  await ready();
  const valid = isAddress(a) && isAddress(b) && !sameAddress(a, b);
  const empty = { valid, pools: [], scanned: "0", total: "0", block: "", hasMore: false, error: "" };
  if (!valid) return empty;
  const settings = configuredNetwork(chain);
  const identity = JSON.stringify([settings, a.toLowerCase(), b.toLowerCase(), revision, retry]);
  try {
    const state = await registryPages(settings, getAddress(a), getAddress(b), identity, Math.max(1, pages));
    const total = state.snapshot?.total ?? 0n;
    return {
      valid,
      pools: state.pools.map(poolCard),
      scanned: state.scanned.toString(),
      total: total.toString(),
      block: state.snapshot ? state.snapshot.blockNumber.toString() : "",
      hasMore: state.scanned < total,
      error: "",
    };
  } catch (error) {
    return { ...empty, error: errorMessage(error) };
  }
}

// --- Snapped form values -------------------------------------------------

function displayedFee(form: CreateForm) {
  return form.exactFee ? percentFromExactFee(form.exactFee) : form.fee;
}

export async function createSnap(route: string) {
  const { form: source, network } = await scope(route);
  const form = network ? snapped(source, network) : source;
  const exact = form.exactFee || exactFeeFromPercent(form.fee);
  const tokens = network ? networkCurrencies(network) : [];
  const symbol = (address: string, fallback: string) =>
    tokens.find((t) => sameAddress(t.address, address))?.symbol ?? fallback;
  const label = (address: string) => {
    const token = tokens.find((t) => sameAddress(t.address, address));
    if (token) return { text: token.symbol, title: "", network: network ? networkName(network.chainId, network.name) : "" };
    if (isAddress(address)) return { text: short(address), title: address, network: "" };
    return { text: "Select token", title: "", network: "" };
  };
  let config = "";
  try {
    config = poolConfig(form.fee, form.range.spacing, form).toLowerCase();
  } catch {
    config = "";
  }
  return {
    pair: [label(form.a), label(form.b)],
    symbols: [symbol(form.a, "First token"), symbol(form.b, "Second token")],
    fee: displayedFee(form),
    exact,
    amplification: form.amplification,
    center: form.center,
    spacing: form.range.spacing,
    spacingLabel: decimalDisplay(spacingPercent(form.range.spacing), 3),
    spacingPercent: decimalDisplay(spacingPercent(form.range.spacing)),
    spacingPresets: [200, 1000, 5982, 19802].map((n) => ({
      n,
      label: `${decimalDisplay(spacingPercent(n), 3)}%`,
    })),
    rangePresets: [4, 16, 64, 256].map((n) => ({
      n,
      label: `±${decimalDisplay(spacingPercent(n * form.range.spacing), 3)}%`,
    })),
    slippage: String(form.slippage),
    maxA: form.maxA,
    maxB: form.maxB,
    config,
    summary: {
      type: form.kind === "stable" ? "Stableswap" : "Concentrated liquidity",
      fee: `${decimalDisplay(Number(percentFromExactFee(exact)))}%`,
      parameter:
        form.kind === "stable"
          ? `Center tick: ${form.center}; amplification exponent: ${form.amplification}`
          : `Tick spacing: ${decimalDisplay(spacingPercent(form.range.spacing), 3)}%`,
      extension: form.extension || zeroAddress,
    },
  };
}

// Tick spacing typed as a percentage or in ticks: what Apply would set.
export async function spacingCandidate(value: string, raw: boolean) {
  try {
    const spacing = raw ? Number(value) : percentToSpacing(Number(value));
    checkSpacing(spacing);
    return { spacing, label: `Applies ${spacing} ticks: ${decimalDisplay(spacingPercent(spacing))}%`, error: "" };
  } catch {
    return { spacing: 0, label: "", error: "Enter a positive spacing that rounds to 1–698605 integer ticks." };
  }
}

// --- The selected pool ---------------------------------------------------

type PoolData = { state: QuoteDataFetcherResult; decimals: [number, number] };
const pools = new Map<string, Promise<PoolData>>();

function poolKeyOf(form: CreateForm, settings: Settings) {
  const tokens = [form.a, form.b].map((address) => {
    const token = networkCurrencies(settings).find((t) => sameAddress(t.address, address));
    if (!token) throw new Error("Import this token's on-chain metadata before selecting a pool.");
    return token;
  });
  const poolKey = {
    token0: getAddress(form.a),
    token1: getAddress(form.b),
    config: poolConfig(form.fee, form.range.spacing, form),
  };
  if (BigInt(form.a) >= BigInt(form.b)) throw new Error("Choose two different tokens in address order.");
  return { poolKey, decimals: tokens.map((t) => t.decimals) as [number, number] };
}

function loadPool(form: CreateForm, settings: Settings, retry: number) {
  const { poolKey, decimals } = poolKeyOf(form, settings);
  const key = JSON.stringify([settings, poolKey, retry]);
  const cached = pools.get(key);
  if (cached) return cached;
  const load = fetchPools(settings, [poolKey]).then(([state]) => ({ state, decimals }));
  pools.set(key, load);
  load.catch(() => pools.delete(key));
  return load;
}

function initialRangePrice(range: CreateForm["range"], decimals: [number, number]) {
  return range.raw
    ? range.ticks[2] === ""
      ? NaN
      : tickPrice(Number(range.ticks[2]), ...decimals)
    : Number(range.prices[2]);
}

// Empty bounds start 16 spacings either side of the price.
function poolRangeDefaults(range: CreateForm["range"], pool: PoolData) {
  const initialized = poolInitialized(pool.state);
  const price = initialized ? tickPrice(pool.state.tick, ...pool.decimals) : initialRangePrice(range, pool.decimals);
  if (!Number.isFinite(price) || price <= 0) return range;
  const center = snapNumber(
    (Math.log(price) - (pool.decimals[0] - pool.decimals[1]) * Math.LN10) / Math.log1p(0.000001),
    -MAX_TICK,
    MAX_TICK,
    range.spacing,
  );
  const bound = (offset: number) =>
    snapPrice(decimalInput(tickPrice(center + range.spacing * offset, ...pool.decimals)), ...pool.decimals, range.spacing);
  return {
    ...range,
    prices: [range.prices[0] || bound(-16), range.prices[1] || bound(16), decimalInput(price)] as CreateForm["range"]["prices"],
  };
}

async function selectedPool(route: string, retry: number) {
  const { form: source, network } = await scope(route);
  if (!network) throw new Error("Enable this network in Networks before using this link.");
  const form = snapped(source, network);
  if (!form.a || !form.b) return { form, network, pool: undefined };
  const pool = await loadPool(form, network, retry);
  return { form: { ...form, range: poolRangeDefaults(form.range, pool) }, network, pool };
}

function chartSelection(range: CreateForm["range"], decimals: [number, number]) {
  try {
    return rangeTicks(range, ...decimals, true);
  } catch {
    return undefined;
  }
}

function chartState(form: CreateForm, pool: PoolData) {
  let state = pool.state;
  if (state.sqrtRatio === 0n && form.range.prices[2]) {
    try {
      const tick = priceToTick(form.range.prices[2], ...pool.decimals, 1, "round");
      state = {
        ...state,
        tick,
        sqrtRatio: fixedSqrtRatioToFloat(toSqrtRatio(tick, "evm")),
        minTick: -MAX_TICK,
        maxTick: MAX_TICK,
        liquidity: 0n,
        ticks: [],
      };
    } catch {
      state = pool.state;
    }
  }
  if (form.kind !== "stable") return state;
  const { lower, upper } = stableBounds(form);
  return {
    ...state,
    liquidity: state.tick < lower || state.tick >= upper ? 0n : state.liquidity,
    ticks: [
      { number: lower, liquidityDelta: state.liquidity },
      { number: upper, liquidityDelta: -state.liquidity },
    ],
  };
}

const NO_CHART = {
  shown: false,
  hypothetical: false,
  price: "",
  lower: "",
  upper: "",
  tick: 0,
  bars: [],
  rows: [],
  selected: false,
  selectionLeft: 0,
  selectionWidth: 0,
  selectionLower: "",
  selectionUpper: "",
  coverage: "",
  empty: false,
  outside: false,
  lowerTick: 0,
  upperTick: 0,
  spacing: 1,
  selectable: false,
};

function chart(form: CreateForm, pool: PoolData, symbols: string[], zoom: number) {
  let state: QuoteDataFetcherResult;
  let selection: { lower: number; upper: number } | undefined;
  let spacing = form.range.spacing;
  try {
    state = chartState(form, pool);
    if (form.kind === "stable") {
      const bounds = stableBounds(form);
      selection = bounds;
      spacing = Math.max(1, Math.ceil((bounds.upper - bounds.lower) / 100));
    } else selection = chartSelection(form.range, pool.decimals);
  } catch {
    return NO_CHART;
  }
  if (state.sqrtRatio === 0n) return NO_CHART;
  const [d0, d1] = pool.decimals;
  const { lower, upper, buckets } = liquidityBuckets(state, spacing, zoom, selection);
  const price = (tick: number) => decimalDisplay(tickPrice(tick, d0, d1), 6);
  const priceNow = tickPrice(state.tick, d0, d1);
  const values = buckets.map((b) => [
    Number(formatUnits(b.amounts[0], d0)) * priceNow,
    Number(formatUnits(b.amounts[1], d1)),
  ]);
  const max = Math.max(...values.map(([x, y]) => x + y), Number.MIN_VALUE);
  const x = (tick: number) => Math.max(0, Math.min(800, ((tick - lower) / Math.max(1, upper - lower)) * 800));
  const hypothetical = pool.state.sqrtRatio === 0n;
  const bars = buckets.flatMap((bucket, i) =>
    bucket.amounts.map((amount, side) => ({
      key: `${bucket.lower}:${side}`,
      x: x(bucket.lower),
      y: 210 - (values[i].slice(0, side + 1).reduce((s, v) => s + v, 0) / max) * 190,
      width: Math.max(0.5, x(bucket.upper) - x(bucket.lower) - 1),
      height: (values[i][side] / max) * 190,
      fill: side === 0 ? "#111" : "#999",
    })),
  );
  return {
    shown: true,
    hypothetical,
    price: `${hypothetical ? "Initial" : "Current"} price: ${price(state.tick)} ${symbols[1]} per ${symbols[0]}`,
    lower: price(lower),
    upper: price(upper),
    tick: x(state.tick),
    bars,
    rows: buckets.map((bucket) => ({
      key: `${bucket.lower}`,
      range: `${price(bucket.lower)}–${price(bucket.upper)}`,
      amount0: formatUnits(bucket.amounts[0], d0),
      amount1: formatUnits(bucket.amounts[1], d1),
    })),
    selected: !!selection,
    selectionLeft: selection ? x(selection.lower) : 0,
    selectionWidth: selection ? Math.max(0, x(selection.upper) - x(selection.lower)) : 0,
    selectionLower: selection ? price(selection.lower) : "",
    selectionUpper: selection ? price(selection.upper) : "",
    coverage: hypothetical
      ? "This is an initial-price preview. The pool has no on-chain liquidity yet."
      : `Depth coverage: ticks ${state.minTick} to ${state.maxTick}, from the latest RPC read.`,
    empty: !hypothetical && state.liquidity === 0n && state.ticks.length === 0,
    outside: !!selection && (selection.lower < lower || selection.upper > upper),
    lowerTick: lower,
    upperTick: upper,
    spacing,
    selectable: form.kind !== "stable",
  };
}

// The selected pool's state, the range it starts with and its depth chart.
export async function createPool(route: string, retry: number, zoom: number) {
  const empty = {
    state: "idle",
    error: "",
    key: "",
    initialized: false,
    prices: ["", "", ""],
    ticks: ["", "", ""],
    chart: NO_CHART,
  };
  try {
    const { form, network, pool } = await selectedPool(route, retry);
    if (!pool) return empty;
    const symbols = [form.a, form.b].map(
      (address, i) =>
        networkCurrencies(network).find((t) => sameAddress(t.address, address))?.symbol ??
        (i === 0 ? "First token" : "Second token"),
    );
    return {
      state: "ready",
      error: "",
      key: JSON.stringify([network.chainId, form.a, form.b, poolConfig(form.fee, form.range.spacing, form), retry]),
      initialized: poolInitialized(pool.state),
      prices: [...form.range.prices],
      ticks: [...form.range.ticks],
      chart: chart(form, pool, symbols, zoom),
    };
  } catch (error) {
    return { ...empty, state: "error", error: errorMessage(error) };
  }
}

// A range bound picked on the chart, or a preset width around the price.
export async function createRangeAt(route: string, retry: number, lower: number, upper: number, spacings: number) {
  const { form, pool } = await selectedPool(route, retry);
  if (!pool) return { ok: false, v0: "", v1: "", v2: "" };
  const range = form.range;
  if (spacings > 0) {
    const center = snapNumber(priceToTick(range.prices[2], ...pool.decimals, 1, "round"), -MAX_TICK, MAX_TICK, range.spacing);
    const edge = Math.floor(MAX_TICK / range.spacing) * range.spacing;
    lower = Math.max(-edge, center - spacings * range.spacing);
    upper = Math.min(edge, center + spacings * range.spacing);
  }
  return {
    ok: true,
    v0: decimalInput(tickPrice(lower, ...pool.decimals)),
    v1: decimalInput(tickPrice(upper, ...pool.decimals)),
    v2: range.prices[2],
  };
}

// Switching between prices and exact ticks converts the bounds.
export async function createRangeMode(route: string, retry: number) {
  try {
    const { form, pool } = await selectedPool(route, retry);
    if (!pool) throw new Error("Pool state is unavailable.");
    const range = form.range;
    const values = range.raw
      ? range.ticks.map((v) => (v === "" ? "" : decimalInput(tickPrice(Number(v), ...pool.decimals))))
      : range.prices.map((v, i) =>
          v === "" ? "" : String(priceToTick(v, ...pool.decimals, i === 2 ? 1 : range.spacing, "round")),
        );
    return { ok: true, error: "", v0: values[0], v1: values[1], v2: values[2] };
  } catch (error) {
    return { ok: false, error: errorMessage(error), v0: "", v1: "", v2: "" };
  }
}

// --- The deposit ---------------------------------------------------------

async function depositTokens(settings: Settings, account: Address, a: string, b: string, revision: number) {
  const metadata = networkCurrencies(settings);
  const tokens = [a, b].map((address) => {
    const currency = metadata.find((entry) => sameAddress(entry.address, address));
    if (!currency) throw new Error("Import this token's on-chain metadata before creating a position.");
    return currency;
  });
  const { balances, allowances } = await tokenSnapshot(
    settings,
    account,
    metadata.map((t) => t.address),
    revision,
    0,
  );
  return tokens.map((currency) => ({
    address: currency.address,
    symbol: currency.symbol,
    decimals: currency.decimals,
    balance: balances.get(currency.address.toLowerCase()) ?? 0n,
    allowance:
      currency.address === zeroAddress
        ? (1n << 256n) - 1n
        : (allowances.get(currency.address.toLowerCase()) ?? 0n),
    metadataMissing: false,
  })) as [Token, Token];
}

const batchSupport = new Map<string, Promise<boolean>>();
function batchSupported(account: Address, settings: Settings) {
  const key = `${account}:${settings.chainId}`;
  let cached = batchSupport.get(key);
  if (!cached) {
    cached = supportsCalls(walletProvider, account, settings);
    batchSupport.set(key, cached);
  }
  return cached;
}

function inactiveSide(form: CreateForm, pool: PoolData) {
  try {
    const { lower, upper, initial } = poolRange(form.range, ...pool.decimals, pool.state.sqrtRatio !== 0n, form);
    const tick = pool.state.sqrtRatio === 0n ? initial : pool.state.tick;
    return [tick >= upper, tick <= lower];
  } catch {
    return [false, false];
  }
}

async function quoteFor(route: string, revision: number, retry: number) {
  const { form, network, pool } = await selectedPool(route, retry);
  if (!pool) return { form, network, pool };
  const account = await connectedAccount();
  let tokens: [Token, Token] | undefined;
  let walletError = "";
  if (account)
    try {
      tokens = await depositTokens(network, account, form.a, form.b, revision);
    } catch (error) {
      walletError = errorMessage(error);
    }
  const amount = form.specified === 0 ? form.maxA : form.maxB;
  if (!amount) return { form, network, pool, account, tokens, walletError };
  try {
    const quote = calculateDepositQuote({
      settings: network,
      account,
      a: form.a,
      b: form.b,
      maxA: form.maxA,
      maxB: form.maxB,
      fee: form.fee,
      range: form.range,
      specified: form.specified,
      options: form,
      initialized: poolInitialized(pool.state),
      state: pool.state,
      tokens,
    });
    return { form, network, pool, account, tokens, walletError, quote };
  } catch (error) {
    return { form, network, pool, account, tokens, walletError, error: errorMessage(error) };
  }
}

function minimum(liquidity: bigint, slippage: number) {
  try {
    return minimumLiquidity(liquidity, slippage);
  } catch {
    return 0n;
  }
}

function createCalls(settings: Settings, quote: ReturnType<typeof calculateDepositQuote>, slippage: number) {
  return depositCalls(quote.tokens, [quote.max0, quote.max1], settings.manager, createDepositTransaction(settings, quote, slippage));
}

const NO_QUOTE = {
  route: "",
  ok: false,
  error: "",
  matching: "",
  inactive: [false, false],
  connected: false,
  ready: false,
  batch: "unknown",
  price: "",
  range: "",
  initial: "",
  unavailable: false,
  rows: [],
  liquidity: "0",
  minLiquidity: "0",
  approvals: [],
  blocked: true,
};

// The deposit preview: matching amount, limits and what the wallet must do.
export async function createQuote(route: string, revision: number, retry: number) {
  try {
    const result = await quoteFor(route, revision, retry);
    if (!result.pool) return { ...NO_QUOTE, route };
    const { form, network, pool, account, tokens, walletError } = result;
    const inactive = "quote" in result && result.quote ? result.quote.inactive : inactiveSide(form, pool);
    const base = {
      ...NO_QUOTE,
      route,
      connected: !!account,
      ready: !!tokens,
      inactive,
      error: ("error" in result ? result.error : undefined) ?? walletError,
    };
    if (!("quote" in result) || !result.quote) return base;
    const quote = result.quote;
    const batch = account ? await batchSupported(account, network) : undefined;
    const [a, b] = quote.tokens;
    const unavailable = quote.sqrtRatio === 0n && quote.initialTick === undefined;
    const price =
      quote.sqrtRatio === 0n ? tickPrice(quote.initialTick ?? 0, a.decimals, b.decimals) : sqrtPrice(quote.sqrtRatio, a.decimals, b.decimals);
    const minLiquidity = minimum(quote.liquidity, form.slippage);
    const maxes = [quote.max0, quote.max1];
    const approvals =
      tokens && batch === false
        ? quote.tokens.flatMap((t, i) => {
            let required = 0n;
            try {
              required = parseAmount(formatUnits(maxes[i], t.decimals), t.decimals);
            } catch {
              return [];
            }
            if (t.address === zeroAddress || t.allowance >= required) return [];
            const reset = t.allowance !== 0n;
            return [{ side: i, label: reset ? `Reset ${t.symbol} approval` : `Approve ${t.symbol}` }];
          })
        : [];
    return {
      ...base,
      ok: true,
      matching: formatUnits(form.specified === 0 ? quote.max1 : quote.max0, quote.tokens[form.specified === 0 ? 1 : 0].decimals),
      batch: batch === undefined ? "unknown" : batch ? "yes" : "no",
      price: `Price (${b.symbol} per ${a.symbol}): ≈ ${displayPrice(price)}`,
      range: `Position range: ≈ ${displayPrice(tickPrice(quote.descriptor.tickLower, a.decimals, b.decimals))} — ${displayPrice(tickPrice(quote.descriptor.tickUpper, a.decimals, b.decimals))}`,
      initial:
        quote.sqrtRatio === 0n
          ? `Initial price: 1 ${a.symbol} unit = ${displayPrice(price)} ${b.symbol} units (tick ${quote.initialTick}).`
          : "",
      unavailable,
      rows: quote.tokens.map((t, i) => ({
        symbol: t.symbol,
        amount: formatUnits(i === 0 ? quote.used0 : quote.used1, t.decimals),
        insufficient: !!tokens && t.balance < maxes[i],
        inactive: quote.inactive[i],
      })),
      liquidity: quote.liquidity.toString(),
      minLiquidity: minLiquidity.toString(),
      approvals,
      blocked:
        batch === undefined ||
        !tokens ||
        minLiquidity === 0n ||
        quote.tokens.some((t, i) => (!batch && t.allowance < maxes[i]) || t.balance < maxes[i]),
    };
  } catch (error) {
    return { ...NO_QUOTE, route, error: errorMessage(error) };
  }
}

export async function createBalance(chain: number, address: string, revision: number) {
  const account = await connectedAccount();
  if (!account) return NO_BALANCE;
  return balanceView(configuredNetwork(chain), account, address, "", revision);
}

export async function createMax(route: string, revision: number, retry: number, side: number) {
  try {
    const result = await quoteFor(route, revision, retry);
    const settings = result.network;
    const quote = "quote" in result ? result.quote : undefined;
    let calls: ReturnType<typeof createCalls> = [];
    try {
      if (quote && settings) calls = createCalls(settings, quote, result.form.slippage);
    } catch {
      calls = [];
    }
    const token = result.tokens?.[side];
    if (!settings || !token)
      return { ok: false, amount: "", message: "Enter an amount first to estimate a gas reserve for Max." };
    return await nativeMax(settings, token.balance, token.decimals, token.symbol, calls);
  } catch (error) {
    return { ok: false, amount: "", message: errorMessage(error) };
  }
}

// Pool state older than this is read again before creating.
const FRESH_MS = 30_000;

export async function createPosition(route: string, revision: number, retry: number, age: number): Promise<TxReply> {
  try {
    if (age > FRESH_MS)
      return {
        ok: false,
        error: "Refreshing the pool and balances. Review the updated deposit preview before creating.",
        hash: "stale",
      };
    const result = await quoteFor(route, revision, retry);
    const quote = "quote" in result ? result.quote : undefined;
    if (!quote || !result.tokens || !result.account || !result.network)
      throw new Error("Connect a wallet and refresh balances and allowances before creating.");
    const slippage = result.form.slippage;
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
      throw new Error("Slippage must be between 0 and 1000 basis points.");
    const settings = result.network;
    const batch = await batchSupported(result.account, settings);
    const transaction = createDepositTransaction(settings, quote, slippage);
    return await execute(
      settings.chainId,
      batch ? depositCalls(quote.tokens, [quote.max0, quote.max1], settings.manager, transaction) : transaction,
    );
  } catch (error) {
    return { ok: false, error: errorMessage(error), hash: "" };
  }
}

export async function createApprove(route: string, revision: number, retry: number, side: number): Promise<TxReply> {
  try {
    const result = await quoteFor(route, revision, retry);
    const quote = "quote" in result ? result.quote : undefined;
    const token = result.tokens?.[side];
    if (!quote || !token || !result.network) throw new Error("Load or refresh balances and allowances before creating.");
    const required = side === 0 ? quote.max0 : quote.max1;
    const reset = token.allowance !== 0n;
    return await execute(
      result.network.chainId,
      approval(token.address, result.network.manager, reset ? 0n : required),
    );
  } catch (error) {
    return { ok: false, error: errorMessage(error), hash: "" };
  }
}

export { PAGE_SIZE };
