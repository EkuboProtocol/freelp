import { decodeEvmPoolConfig, toSqrtRatio } from "@ekubo/sdk";
import {
  formatUnits,
  getAddress,
  isAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
} from "viem";
import { parseAmount } from "../amounts";
import { approval, managerData, type Token } from "../contracts";
import { decimalDisplay } from "../decimalFormat";
import { depositWithRefund } from "../depositTransaction";
import { quoteDeposit } from "../depositQuote";
import { displayAmount } from "../displayAmount";
import { errorMessage } from "../errors";
import { percentFromExactFee } from "../fee";
import { configuredNetwork, loadNetworks, networkName } from "../networks";
import { walletProvider } from "../page";
import { spacingPercent } from "../pools";
import { loadPortfolio, type PortfolioResult } from "../portfolio";
import { extractPositionArtworkImage } from "../positionArtwork";
import { loadPositionById } from "../positionLookup";
import { minimumLiquidity, withdrawalReview } from "../positionReview";
import { readPositionToken, type PositionTokenRead } from "../positionToken";
import { displayPrice, sqrtPrice, tickPrice } from "../prices";
import { loadTokenCatalog } from "../tokenCatalog";
import { networkCurrencies } from "../tokens";
import { depositCalls, supportsCalls } from "../walletCalls";
import type { Descriptor, Position, Settings, Transaction } from "../types";
import { balanceView, nativeMax } from "./balances";
import { connectedAccount, execute, type TxReply } from "./tx";

// Positions: the portfolio across enabled networks, one position's detail,
// and its add, withdraw and collect transactions. Reads are memoised by
// their arguments so a re-render never repeats an RPC request.

// A request belongs to the answer that started it: its timers stop when
// that answer is let go. Another answer reuses it in flight, but starts its
// own when the shared one fails, and only good answers are kept.
const memo = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
async function once<T>(
  key: string,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
): Promise<T> {
  if (memo.has(key)) return memo.get(key) as T;
  const shared = inflight.get(key) as Promise<T> | undefined;
  if (shared) {
    const value = await shared.catch(() => undefined);
    if (value !== undefined && keep(value)) return value;
  }
  const request = load();
  inflight.set(key, request);
  try {
    const value = await request;
    if (keep(value)) memo.set(key, value);
    return value;
  } finally {
    if (inflight.get(key) === request) inflight.delete(key);
  }
}

function enabledNetwork(chainId: number) {
  return loadNetworks().find((network) => network.chainId === chainId);
}

export async function positionNetworks() {
  await connectedAccount();
  return loadNetworks().map((network) => ({
    id: network.chainId,
    name: networkName(network.chainId, network.name),
  }));
}

// The latest portfolio read per chain and account, which a detail reuses.
const latest = new Map<string, PortfolioResult>();
async function chainPortfolio(
  settings: Settings,
  account: Address,
  revision: number,
  tick: string,
) {
  const scope = `${settings.chainId}:${settings.rpcUrl}:${account}:${revision}`;
  const result = await once(
    `portfolio:${scope}:${tick}`,
    () =>
      loadPortfolio(settings, account).catch((error): PortfolioResult => ({
        items: [],
        availability: "unavailable",
        error: errorMessage(error),
      })),
    (value) => value.availability !== "unavailable",
  );
  if (result.availability !== "unavailable") latest.set(scope, result);
  return result;
}
async function latestPortfolio(
  settings: Settings,
  account: Address,
  revision: number,
) {
  const scope = `${settings.chainId}:${settings.rpcUrl}:${account}:${revision}`;
  return latest.get(scope) ?? chainPortfolio(settings, account, revision, "0");
}

function poolFacts(descriptor: Descriptor) {
  const config = decodeEvmPoolConfig(descriptor.poolKey.config);
  const percent = percentFromExactFee(config.fee.toString());
  const concentrated = config.poolType === "concentrated";
  const stable = config.poolType === "stableswap";
  return {
    feeLabel: `Fee: ${decimalDisplay(Number(percent))}%`,
    feeTitle: `${percent}%`,
    kindLabel: concentrated
      ? `Tick spacing: ${decimalDisplay(spacingPercent(config.tickSpacing))}%`
      : stable
        ? "Stableswap"
        : "Full range",
    token0: descriptor.poolKey.token0,
    token1: descriptor.poolKey.token1,
    poolType: concentrated
      ? "Concentrated liquidity"
      : stable
        ? "Stableswap"
        : "Full range",
    fee: config.fee.toString(),
    concentrated,
    tickSpacing: String(config.tickSpacing ?? ""),
    centerTick: String(config.stableswapParams?.centerTick ?? ""),
    amplification: String(config.stableswapParams?.amplification ?? ""),
    extension: config.extension,
    config: descriptor.poolKey.config,
  };
}

function positionState(position: Position) {
  if (position.amounts.liquidity === 0n) return "closed";
  return position.sqrtRatio >=
    toSqrtRatio(position.descriptor.tickLower, "evm") &&
    position.sqrtRatio < toSqrtRatio(position.descriptor.tickUpper, "evm")
    ? "active"
    : "inactive";
}

const NO_RANGE = {
  lower: "",
  current: "",
  upper: "",
  unit: "",
  marker: 0,
  label: "",
};
function rangeView(
  position: Position,
  decimals: [number, number],
  symbols: [string, string],
) {
  const lower = tickPrice(position.descriptor.tickLower, ...decimals);
  const upper = tickPrice(position.descriptor.tickUpper, ...decimals);
  const current = sqrtPrice(position.sqrtRatio, ...decimals);
  const ratio =
    (Math.log(current) - Math.log(lower)) / (Math.log(upper) - Math.log(lower));
  const marker = Math.max(0, Math.min(100, ratio * 100));
  return {
    lower: displayPrice(lower),
    current: displayPrice(current),
    upper: displayPrice(upper),
    unit: `${symbols[1]} per ${symbols[0]}`,
    marker: Number.isFinite(marker) ? marker : 0,
    label: `Current price ${displayPrice(current)}; range ${displayPrice(lower)} to ${displayPrice(upper)}`,
  };
}

function card(settings: Settings, p: Position) {
  const tokens = [p.descriptor.poolKey.token0, p.descriptor.poolKey.token1].map(
    (address) =>
      networkCurrencies(settings).find(
        (t) => t.address.toLowerCase() === address.toLowerCase(),
      ),
  );
  const amount = (value: bigint, i: number) =>
    `${displayAmount(value, tokens[i]?.decimals ?? 0)} ${tokens[i]?.symbol ?? "raw units"}`;
  const known = !!tokens[0] && !!tokens[1];
  return {
    key: `${settings.chainId}:${p.id}`,
    chainId: settings.chainId,
    id: p.id.toString(),
    title: `${tokens[0]?.symbol ?? p.descriptor.poolKey.token0.slice(0, 8)} / ${tokens[1]?.symbol ?? p.descriptor.poolKey.token1.slice(0, 8)}`,
    network: networkName(settings.chainId, settings.name),
    status: positionState(p),
    principal: `Principal: ${amount(p.amounts.principal0, 0)} / ${amount(p.amounts.principal1, 1)}`,
    fees: `Uncollected fees: ${amount(p.amounts.fees0, 0)} / ${amount(p.amounts.fees1, 1)}`,
    pool: poolFacts(p.descriptor),
    hasRange: known,
    range: known
      ? rangeView(
          p,
          [tokens[0]!.decimals, tokens[1]!.decimals],
          [tokens[0]!.symbol, tokens[1]!.symbol],
        )
      : NO_RANGE,
  };
}

// One enabled network's positions for the connected wallet. `tick` changes
// when the person refreshes or retries this network.
export async function chainPositions(
  chainId: number,
  revision: number,
  tick: string,
) {
  const account = await connectedAccount();
  const settings = enabledNetwork(chainId);
  const base = {
    loaded: true,
    chainId,
    name: networkName(chainId, settings?.name),
    availability: "available-empty",
    message: "",
    positions: [] as ReturnType<typeof card>[],
  };
  if (!account || !settings) return base;
  const result = await chainPortfolio(settings, account, revision, tick);
  await loadTokenCatalog(chainId);
  return {
    ...base,
    availability: result.availability,
    message:
      result.availability === "proven-not-deployed"
        ? "FreeLP is not deployed on this network yet."
        : result.availability === "unavailable"
          ? (result.error ?? "This network is unavailable.")
          : "",
    positions: result.items.map((item) => card(settings, item)),
  };
}

type Detail = {
  settings: Settings;
  position: Position;
  owner: Address;
  owned: boolean;
  fromPortfolio: boolean;
  reads: [PositionTokenRead, PositionTokenRead];
};
type DetailResult =
  | { state: "found"; detail: Detail }
  | { state: "missing" | "error" | "disabled"; message: string };

async function findPosition(
  settings: Settings,
  id: bigint,
  account: Address | undefined,
  revision: number,
) {
  if (account) {
    const owned = (
      await latestPortfolio(settings, account, revision)
    ).items.find((item) => item.id === id);
    if (owned) return { owner: account, position: owned, fromPortfolio: true };
  }
  const found = await loadPositionById(settings, id);
  return found && { ...found, fromPortfolio: false };
}

function loadDetail(
  chainId: number,
  id: string,
  account: Address | undefined,
  revision: number,
  tick: number,
): Promise<DetailResult> {
  return once(
    `detail:${chainId}:${id}:${account}:${revision}:${tick}`,
    async (): Promise<DetailResult> => {
      const settings = enabledNetwork(chainId);
      if (!settings) return { state: "disabled", message: "" };
      try {
        const found = await findPosition(
          settings,
          BigInt(id),
          account,
          revision,
        );
        if (!found) return { state: "missing", message: "" };
        const holder = account ?? found.owner;
        const { token0, token1 } = found.position.descriptor.poolKey;
        const reads = await Promise.all([
          readPositionToken(settings, token0, holder),
          readPositionToken(settings, token1, holder),
        ]);
        return {
          state: "found",
          detail: {
            settings,
            ...found,
            owned: !!account && isAddressEqual(found.owner, account),
            reads,
          },
        };
      } catch (error) {
        return { state: "error", message: errorMessage(error) };
      }
    },
    (value) =>
      value.state !== "error" &&
      (value.state !== "found" ||
        value.detail.reads.every((read) => !read.error)),
  );
}

const EMPTY_DETAIL = {
  state: "",
  message: "",
  chainId: 0,
  id: "",
  network: "",
  fromPortfolio: false,
  owner: "",
  ownerShort: "",
  owned: false,
  closed: false,
  title: "Manage position",
  status: "",
  pool: {
    feeLabel: "",
    feeTitle: "",
    kindLabel: "",
    token0: "",
    token1: "",
    poolType: "",
    fee: "",
    concentrated: false,
    tickSpacing: "",
    centerTick: "",
    amplification: "",
    extension: "",
    config: "",
  },
  artwork: "",
  liquidity: [] as AmountRow[],
  fees: [] as AmountRow[],
  feesZero: true,
  range: NO_RANGE,
  tokens: [] as {
    address: string;
    symbol: string;
    decimals: number;
    missing: boolean;
  }[],
};
type AmountRow = {
  symbol: string;
  note: string;
  display: string;
  title: string;
};

function amountRows(tokens: Token[], values: [bigint, bigint]): AmountRow[] {
  return tokens.map((t, i) => ({
    symbol: t.symbol,
    note: t.metadataMissing ? "Raw units · decimals unavailable" : "",
    display: displayAmount(values[i], t.decimals),
    title: t.metadataMissing
      ? `${values[i].toString()} raw units`
      : `${formatUnits(values[i], t.decimals)} ${t.symbol}`,
  }));
}

function inactiveSides(p: Position) {
  return [
    p.sqrtRatio >= toSqrtRatio(p.descriptor.tickUpper, "evm"),
    p.sqrtRatio <= toSqrtRatio(p.descriptor.tickLower, "evm"),
  ];
}

// One position by network and number: the connected wallet's own from its
// portfolio, else anyone's by its owner, read-only.
export async function positionDetail(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
) {
  const account = await connectedAccount();
  const result = await loadDetail(chainId, id, account, revision, tick);
  const base = { ...EMPTY_DETAIL, chainId, id };
  if (result.state !== "found")
    return { ...base, state: result.state, message: result.message };
  const {
    settings,
    position: p,
    owner,
    owned,
    fromPortfolio,
    reads,
  } = result.detail;
  const tokens = reads.map((read) => read.token);
  return {
    ...base,
    state: "found",
    network: networkName(settings.chainId, settings.name),
    fromPortfolio,
    owner,
    ownerShort: `${owner.slice(0, 6)}…${owner.slice(-4)}`,
    owned,
    closed: p.amounts.liquidity === 0n,
    title: `${tokens[0].symbol} / ${tokens[1].symbol}`,
    status: positionState(p),
    pool: poolFacts(p.descriptor),
    artwork: extractPositionArtworkImage(p.metadata) ?? "",
    liquidity: amountRows(tokens, [p.amounts.principal0, p.amounts.principal1]),
    fees: amountRows(tokens, [p.amounts.fees0, p.amounts.fees1]),
    feesZero: p.amounts.fees0 === 0n && p.amounts.fees1 === 0n,
    range: rangeView(
      p,
      [tokens[0].decimals, tokens[1].decimals],
      [tokens[0].symbol, tokens[1].symbol],
    ),
    tokens: tokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
      missing: t.metadataMissing,
    })),
  };
}

async function found(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
) {
  const account = await connectedAccount();
  const result = await loadDetail(chainId, id, account, revision, tick);
  if (result.state !== "found") throw new Error("Position unavailable.");
  return { account, ...result.detail };
}

function reviewLines(tokens: Token[], values: [bigint, bigint]) {
  return values.map(
    (value, i) =>
      `${tokens[i].metadataMissing ? value.toString() : formatUnits(value, tokens[i].decimals)} ${tokens[i].symbol}${tokens[i].metadataMissing ? " (raw units)" : ""}`,
  );
}

export async function withdrawReview(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
  portion: number,
  recipient: string,
) {
  const recipientOk = isAddress(recipient);
  const none = {
    ok: false,
    error: "",
    recipientOk,
    principal: [] as string[],
    fees: [] as string[],
    receipt: [] as string[],
    full: false,
  };
  try {
    const { position, reads } = await found(chainId, id, revision, tick);
    const tokens = reads.map((read) => read.token);
    try {
      const review = withdrawalReview(position.amounts, portion);
      return {
        ok: true,
        error: "",
        recipientOk,
        principal: reviewLines(tokens, [review.principal0, review.principal1]),
        fees: reviewLines(tokens, [review.fees0, review.fees1]),
        receipt: reviewLines(tokens, [review.total0, review.total1]),
        full: review.full,
      };
    } catch (error) {
      return {
        ...none,
        error: error instanceof Error ? error.message : "Invalid withdrawal.",
      };
    }
  } catch {
    return none;
  }
}

function batchSupport(account: Address, settings: Settings) {
  return once(`batch:${account}:${settings.chainId}`, () =>
    supportsCalls(walletProvider, account, settings),
  );
}

function parseRequested(value: string, decimals: number) {
  try {
    return parseAmount(value || "0", decimals);
  } catch {
    return undefined;
  }
}

function safeMinimum(liquidity: bigint | undefined, slippage: number) {
  if (liquidity === undefined) return 0n;
  try {
    return minimumLiquidity(liquidity, slippage);
  } catch {
    return 0n;
  }
}

// The deposit a typed amount on `side` implies, and what blocks it.
function quote(detail: Detail, side: number, value: string) {
  const tokens = detail.reads.map((read) => read.token) as [Token, Token];
  const p = detail.position;
  const s = side === 1 ? 1 : 0;
  const inactive = inactiveSides(p);
  try {
    const amounts: [bigint, bigint] = [0n, 0n];
    amounts[s] = parseAmount(value || "0", tokens[s].decimals);
    const result = quoteDeposit(p.descriptor, p.sqrtRatio, amounts, s);
    const shown = [0, 1].map((i) =>
      inactive[i]
        ? "0"
        : i === s
          ? value
          : formatUnits(
              i === 0 ? result.max0 : result.max1,
              tokens[i].decimals,
            ),
    );
    return { tokens, inactive, shown, result, error: "" };
  } catch (error) {
    const shown = [0, 1].map((i) => (inactive[i] ? "0" : i === s ? value : ""));
    return {
      tokens,
      inactive,
      shown,
      result: undefined,
      error: errorMessage(error),
    };
  }
}

function addTransaction(
  detail: Detail,
  q: ReturnType<typeof quote>,
  slippage: number,
) {
  if (!detail.reads.every((read) => read.balanceReady && read.allowanceReady))
    throw new Error(
      "Token balances and allowances are still loading. Retry when ready.",
    );
  if (!q.result) throw new Error("Wait for the matching deposit amount.");
  const { max0, max1, liquidity } = q.result;
  const p = detail.position;
  return depositWithRefund(
    detail.settings,
    managerData("addLiquidity", [
      p.id,
      max0,
      max1,
      minimumLiquidity(liquidity, slippage),
    ]),
    p.descriptor.poolKey.token0 === zeroAddress ? max0 : 0n,
  );
}

function gasCalls(
  detail: Detail,
  q: ReturnType<typeof quote>,
  slippage: number,
) {
  try {
    const transaction = addTransaction(detail, q, slippage);
    return depositCalls(
      q.tokens,
      [q.result!.max0, q.result!.max1],
      detail.settings.manager,
      transaction,
    );
  } catch {
    return [] as Transaction[];
  }
}

function approvalLabel(token: Token, amount: string) {
  let required = 0n;
  try {
    required = parseAmount(amount, token.decimals);
  } catch {
    return "";
  }
  if (token.address === zeroAddress || token.allowance >= required) return "";
  return token.allowance !== 0n
    ? `Reset ${token.symbol} approval`
    : `Approve ${token.symbol}`;
}

type Quote = ReturnType<typeof quote>;

// What the typed amounts ask of the wallet's balances and allowances.
function spendCheck(detail: Detail, q: Quote, batch: boolean | undefined) {
  const spendReady = detail.reads.every(
    (read) => read.balanceReady && read.allowanceReady,
  );
  const requested = q.tokens.map((token, i) =>
    parseRequested(q.shown[i], token.decimals),
  );
  const amounts = requested.filter((a): a is bigint => a !== undefined);
  const reading =
    !!q.result && spendReady && amounts.length === requested.length;
  const exceeds = (limit: (token: Token) => bigint) =>
    reading && amounts.some((a, i) => a > limit(q.tokens[i]));
  return {
    spendReady,
    reading,
    insufficient: exceeds((token) => token.balance),
    approvalNeeded: batch === false && exceeds((token) => token.allowance),
  };
}

function approvalsFor(q: Quote, batch: boolean | undefined, ready: boolean) {
  if (batch !== false || !ready) return [];
  return q.tokens
    .map((token, i) => ({
      index: i,
      label: approvalLabel(token, q.shown[i] || "0"),
    }))
    .filter((a) => a.label !== "");
}

function canAdd(
  detail: Detail & { account?: Address },
  q: Quote,
  batch: boolean | undefined,
  minLiquidity: bigint,
  check: ReturnType<typeof spendCheck>,
) {
  return [
    !!detail.account,
    batch !== undefined,
    (q.result?.liquidity ?? 0n) > 0n,
    minLiquidity > 0n,
    check.reading,
    !check.insufficient,
    !check.approvalNeeded,
  ].every(Boolean);
}

export async function depositView(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
  side: number,
  value: string,
  slippage: number,
) {
  const detail = await found(chainId, id, revision, tick);
  const q = quote(detail, side, value);
  const batch = detail.account
    ? await batchSupport(detail.account, detail.settings)
    : undefined;
  const check = spendCheck(detail, q, batch);
  const minLiquidity = safeMinimum(q.result?.liquidity, slippage);
  return {
    sides: q.tokens.map((token, i) => ({
      index: i,
      symbol: token.symbol,
      missing: token.metadataMissing,
      inactive: q.inactive[i],
      amount: q.shown[i],
    })),
    error: q.error,
    spendReady: check.spendReady,
    readError: detail.reads
      .map((read) => read.error)
      .filter(Boolean)
      .join(" "),
    insufficient: check.insufficient,
    approvalNeeded: check.approvalNeeded,
    minZero: !!q.result && minLiquidity === 0n,
    canAdd: canAdd(detail, q, batch, minLiquidity, check),
    approvals: approvalsFor(q, batch, check.spendReady),
  };
}

const fail = (error: unknown): TxReply => ({
  ok: false,
  error: errorMessage(error),
  hash: "",
});

export async function addLiquidity(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
  side: number,
  value: string,
  slippage: number,
): Promise<TxReply> {
  try {
    const detail = await found(chainId, id, revision, tick);
    if (!detail.account) throw new Error("Connect a wallet first.");
    const q = quote(detail, side, value);
    const transaction = addTransaction(detail, q, slippage);
    if (minimumLiquidity(q.result!.liquidity, slippage) <= 0n)
      throw new Error("Slippage would reduce minimum liquidity to zero.");
    const batch = await batchSupport(detail.account, detail.settings);
    return await execute(
      chainId,
      batch
        ? depositCalls(
            q.tokens,
            [q.result!.max0, q.result!.max1],
            detail.settings.manager,
            transaction,
          )
        : transaction,
    );
  } catch (error) {
    return fail(error);
  }
}

export async function approvePositionToken(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
  index: number,
  amount: string,
): Promise<TxReply> {
  try {
    const detail = await found(chainId, id, revision, tick);
    const token = detail.reads[index === 1 ? 1 : 0].token;
    const required = parseAmount(amount || "0", token.decimals);
    const reset = token.allowance !== 0n;
    return await execute(
      chainId,
      approval(token.address, detail.settings.manager, reset ? 0n : required),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function positionNativeMax(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
  side: number,
  value: string,
  slippage: number,
  index: number,
) {
  try {
    const detail = await found(chainId, id, revision, tick);
    const q = quote(detail, side, value);
    const token = q.tokens[index === 1 ? 1 : 0];
    return await nativeMax(
      detail.settings,
      token.balance,
      token.decimals,
      token.symbol,
      gasCalls(detail, q, slippage),
    );
  } catch (error) {
    return { ok: false, amount: "", message: errorMessage(error) };
  }
}

export async function withdrawPosition(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
  portion: number,
  recipient: string,
): Promise<TxReply> {
  try {
    const detail = await found(chainId, id, revision, tick);
    if (!detail.account) throw new Error("Connect a wallet first.");
    if (!isAddress(recipient))
      throw new Error("Enter a valid recipient address to withdraw.");
    const review = withdrawalReview(detail.position.amounts, portion);
    return await execute(chainId, {
      to: detail.settings.manager,
      data: managerData("multicall", [
        [
          managerData("withdraw", [
            detail.position.id,
            review.liquidity,
            getAddress(recipient),
          ]),
        ],
      ]),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function collectFees(
  chainId: number,
  id: string,
  revision: number,
  tick: number,
): Promise<TxReply> {
  try {
    const detail = await found(chainId, id, revision, tick);
    if (!detail.account) throw new Error("Connect a wallet first.");
    return await execute(chainId, {
      to: detail.settings.manager,
      data: managerData("multicall", [
        [managerData("withdraw", [detail.position.id, 0n, detail.account])],
      ]),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function positionBalance(
  chainId: number,
  address: string,
  revision: number,
  tick: number,
) {
  const account = await connectedAccount();
  return balanceView(
    configuredNetwork(chainId),
    account,
    address,
    "",
    revision * 1000 + tick,
  );
}
