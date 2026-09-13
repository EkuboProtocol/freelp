import { getAddress, isAddress } from "viem";
import type { CreateForm } from "./createForm";
import { decimalInput } from "./decimalFormat";
import { priceToTick, tickPrice, type RangeInput } from "./prices";

export function changeCreateToken(
  form: CreateForm,
  side: 0 | 1,
  address: string,
): CreateForm {
  const normalized = getAddress(address);
  const same = side === 0 ? form.a : form.b;
  if (normalized.toLowerCase() === same.toLowerCase()) return form;
  const other = side === 0 ? form.b : form.a;
  if (normalized.toLowerCase() === other.toLowerCase())
    throw new Error("Choose two different tokens for this position.");
  const pair = side === 0 ? [normalized, other] : [other, normalized];
  if (
    pair.every((value) => isAddress(value)) &&
    BigInt(pair[0]) > BigInt(pair[1])
  )
    pair.reverse();
  // A genuine replacement is not an inversion of the previous trading pair.
  return {
    ...form,
    a: pair[0],
    b: pair[1],
    maxA: "",
    maxB: "",
    specified: 0,
    range: {
      ...form.range,
      full: false,
      raw: false,
      prices: ["", "", ""],
      ticks: ["", "", ""],
    },
  };
}

export function changeCreateAmount(
  form: CreateForm,
  side: 0 | 1,
  value: string,
): CreateForm {
  return {
    ...form,
    specified: side,
    maxA: side === 0 ? value : "",
    maxB: side === 1 ? value : "",
  };
}

export function changeRangeMode(
  range: RangeInput,
  decimals: [number, number],
): RangeInput {
  if (range.raw) {
    const prices = range.ticks.map((value) =>
      value === "" ? "" : decimalInput(tickPrice(Number(value), ...decimals)),
    ) as RangeInput["prices"];
    return { ...range, full: false, raw: false, prices };
  }
  const ticks = range.prices.map((value, index) =>
    value === ""
      ? ""
      : String(
          priceToTick(
            value,
            ...decimals,
            index === 2 ? 1 : range.spacing,
            "round",
          ),
        ),
  ) as RangeInput["ticks"];
  return { ...range, full: false, raw: true, ticks };
}
