import { DEFAULT_RANGE, type RangeInput } from "./prices";
import { zeroAddress } from "viem";
export function defaultCreateForm(chain: number) {
  return {
    chain,
    a: "",
    b: "",
    maxA: "",
    maxB: "",
    specified: 0 as 0 | 1,
    fee: "0.3",
    exactFee: "",
    extension: zeroAddress as string,
    kind: "concentrated" as "concentrated" | "stable",
    amplification: "10",
    center: "0",
    range: { ...DEFAULT_RANGE, prices: ["", "", ""] } as RangeInput,
    slippage: 50,
  };
}
export type CreateForm = ReturnType<typeof defaultCreateForm>;
const strings = [
  "a",
  "b",
  "maxA",
  "maxB",
  "fee",
  "exactFee",
  "extension",
  "amplification",
  "center",
] as const;
export function readCreateForm(hash: string, chain: number): CreateForm {
  const result = defaultCreateForm(chain);
  const params = new URLSearchParams(hash.split("?")[1]);
  for (const name of strings) result[name] = params.get(name) ?? result[name];
  for (const name of ["chain", "slippage"] as const) {
    const value = params.get(name);
    if (value !== null && Number.isFinite(Number(value)))
      result[name] = Number(value);
  }
  result.specified = params.get("specified") === "1" ? 1 : 0;
  result.kind = params.get("kind") === "stable" ? "stable" : "concentrated";
  result.range = readRange(params, result.range);
  return result;
}
function readRange(params: URLSearchParams, range: RangeInput): RangeInput {
  const spacing = Number(params.get("spacing") ?? range.spacing);
  return {
    raw: params.get("raw") === "true",
    full: params.get("full") === "true",
    spacing: Number.isFinite(spacing) ? spacing : range.spacing,
    prices: [0, 1, 2].map(
      (i) => params.get(`price${i}`) ?? range.prices[i],
    ) as RangeInput["prices"],
    ticks: [0, 1, 2].map(
      (i) => params.get(`tick${i}`) ?? range.ticks[i],
    ) as RangeInput["ticks"],
  };
}
export function createFormHash(form: CreateForm) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(form))
    if (name !== "range") params.set(name, String(value));
  for (const name of ["raw", "full", "spacing"] as const)
    params.set(name, String(form.range[name]));
  form.range.prices.forEach((value, i) => params.set(`price${i}`, value));
  form.range.ticks.forEach((value, i) => params.set(`tick${i}`, value));
  return `#/create?${params}`;
}
