export const MAX_TICK_SPACING = 698605;
export function checkSpacing(spacing: number) {
  if (!Number.isInteger(spacing) || spacing < 1 || spacing > MAX_TICK_SPACING)
    throw new Error("Tick spacing must be an integer between 1 and 698605.");
}
// Ported from interface/util/common/format.ts: each tick changes price by 1.000001.
export function spacingPercent(spacing: number) {
  return Math.expm1(spacing * Math.log1p(0.000001)) * 100;
}
export function percentToSpacing(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0)
    throw new Error("Enter a positive tick spacing percentage.");
  const spacing = Math.round(Math.log1p(percent / 100) / Math.log1p(0.000001));
  checkSpacing(spacing);
  return spacing;
}
