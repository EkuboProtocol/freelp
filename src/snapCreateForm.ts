import { formatUnits } from "viem";
import { decimalDisplay } from "./decimalFormat";
import { MAX_TICK, tickPrice, priceToTick } from "./prices";
import { MAX_TICK_SPACING } from "./pools";
import { exactFeeFromPercent, percentFromExactFee } from "./fee";
import type { CreateForm } from "./createForm";
import type { Currency } from "./tokens";
export function snapNumber(value: number, min: number, max: number, step = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(
    Math.ceil(min / step) * step,
    Math.min(Math.floor(max / step) * step, Math.round(value / step) * step),
  );
}
export function snapTick(value: string, spacing: number) {
  return value === ""
    ? ""
    : String(snapNumber(Number(value), -MAX_TICK, MAX_TICK, spacing));
}
export function snapPrice(
  value: string,
  d0: number,
  d1: number,
  spacing: number,
) {
  if (value === "") return "";
  const price = Number(value);
  if (!Number.isFinite(price)) return value;
  if (price <= 0)
    return decimalDisplay(
      tickPrice(snapNumber(-MAX_TICK, -MAX_TICK, MAX_TICK, spacing), d0, d1),
      12,
    );
  const tick = (Math.log(price) - (d0 - d1) * Math.LN10) / Math.log1p(0.000001);
  return decimalDisplay(
    tickPrice(snapNumber(tick, -MAX_TICK, MAX_TICK, spacing), d0, d1),
    12,
  );
}
function snapExact(value: string) {
  if (!/^-?\d+$/.test(value)) return value;
  const n = BigInt(value),
    max = (1n << 64n) - 1n;
  return String(n < 0n ? 0n : n > max ? max : n);
}
function snapAmount(value: string, decimals: number) {
  if (!/^\d+(\.\d*)?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(
    whole + fraction.slice(0, decimals).padEnd(decimals, "0"),
  );
  const max = (1n << 128n) - 1n;
  return formatUnits(amount > max ? max : amount, decimals);
}
export function snapCreateForm(form: CreateForm, tokens: Currency[]) {
  const spacing = snapNumber(form.range.spacing, 1, MAX_TICK_SPACING);
  const metadata = [form.a, form.b].map((address) =>
    tokens.find(
      (token) => token.address.toLowerCase() === address.toLowerCase(),
    ),
  );
  const [a, b] = metadata;
  const fee = snapFee(form.fee);
  const range = {
    ...form.range,
    spacing,
    ticks: form.range.ticks.map((value, i) =>
      snapTick(value, i === 2 ? 1 : spacing),
    ) as CreateForm["range"]["ticks"],
    prices: form.range.prices.map((value, i) =>
      a && b
        ? snapPrice(value, a.decimals, b.decimals, i === 2 ? 1 : spacing)
        : value,
    ) as CreateForm["range"]["prices"],
  };
  return {
    ...form,
    fee,
    range: orderedRange(range, a, b),
    exactFee: snapExact(form.exactFee),
    amplification: snapTextNumber(form.amplification, 0, 26),
    center: snapTextNumber(form.center, -MAX_TICK, MAX_TICK, 16),
    slippage: snapNumber(form.slippage, 0, 1000),
    maxA: a ? snapAmount(form.maxA, a.decimals) : form.maxA,
    maxB: b ? snapAmount(form.maxB, b.decimals) : form.maxB,
  };
}
function snapTextNumber(value: string, min: number, max: number, step = 1) {
  return value === "" ? "" : String(snapNumber(Number(value), min, max, step));
}
function snapFee(value: string) {
  if (value === "" || !Number.isFinite(Number(value))) return value;
  if (Number(value) >= 100)
    return percentFromExactFee(String((1n << 64n) - 1n));
  if (Number(value) < 0) return "0";
  return percentFromExactFee(exactFeeFromPercent(value));
}

function orderedRange(range: CreateForm["range"], a?: Currency, b?: Currency) {
  if (range.full || !a || !b) return range;
  try {
    const [lower, upper] = range.raw
      ? range.ticks.map(Number)
      : range.prices
          .slice(0, 2)
          .map((value) =>
            priceToTick(value, a.decimals, b.decimals, range.spacing, "round"),
          );
    if (lower < upper) return range;
    const low = snapNumber(
      (lower + upper - range.spacing) / 2,
      -MAX_TICK,
      MAX_TICK - range.spacing,
      range.spacing,
    );
    const high = low + range.spacing;
    return {
      ...range,
      ticks: [
        String(low),
        String(high),
        range.ticks[2],
      ] as CreateForm["range"]["ticks"],
      prices: [
        decimalDisplay(tickPrice(low, a.decimals, b.decimals), 12),
        decimalDisplay(tickPrice(high, a.decimals, b.decimals), 12),
        range.prices[2],
      ] as CreateForm["range"]["prices"],
    };
  } catch {
    return range;
  }
}
