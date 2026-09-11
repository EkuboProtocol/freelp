// Expand scientific notation for human-readable prices; never used for transaction arithmetic.
export function expandDecimal(value: string) {
  const [mantissa, power] = value.toLowerCase().split("e");
  if (power === undefined) return mantissa;
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = whole + fraction;
  const point = whole.length + Number(power);
  let result: string;
  if (point <= 0) result = "0." + "0".repeat(-point) + digits;
  else if (point >= digits.length)
    result = digits + "0".repeat(point - digits.length);
  else result = digits.slice(0, point) + "." + digits.slice(point);
  return (negative ? "-" : "") + result;
}
export function decimalInput(value: number) {
  return Number.isFinite(value) ? expandDecimal(String(value)) : "";
}
export function decimalDisplay(value: number, precision = 8) {
  if (!Number.isFinite(value)) return "—";
  return expandDecimal(String(Number(value.toPrecision(precision))));
}
