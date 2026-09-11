import type { Settings } from "./types";
export function nativeCurrency(
  settings: Pick<Settings, "nativeSymbol" | "nativeName" | "nativeDecimals">,
) {
  return {
    symbol: settings.nativeSymbol,
    name:
      settings.nativeName ??
      (settings.nativeSymbol === "ETH" ? "Ether" : settings.nativeSymbol),
    decimals: settings.nativeDecimals ?? 18,
  };
}
export function validateNativeCurrency(settings: Settings) {
  const native = nativeCurrency(settings);
  if (
    typeof native.name !== "string" ||
    !native.name.trim() ||
    native.name.length > 80
  )
    throw new Error("Enter a native token name of 1–80 characters.");
  if (!native.symbol.trim() || native.symbol.length > 16)
    throw new Error("Enter a native token symbol of 1–16 characters.");
  if (
    !Number.isInteger(native.decimals) ||
    native.decimals < 0 ||
    native.decimals > 255
  )
    throw new Error(
      "Native token decimals must be an integer between 0 and 255.",
    );
  return {
    nativeSymbol: native.symbol.trim(),
    nativeName: native.name.trim(),
    nativeDecimals: native.decimals,
  };
}
