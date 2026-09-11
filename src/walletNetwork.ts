import type { Provider, Settings } from "./types";
export async function switchWalletChain(
  provider: Provider,
  settings: Settings,
) {
  const chainId = `0x${settings.chainId.toString(16)}`;
  const switchChain = () =>
    provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  try {
    await switchChain();
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== 4902
    )
      throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: settings.name || `Chain ${settings.chainId}`,
          nativeCurrency: {
            name: settings.nativeSymbol,
            symbol: settings.nativeSymbol,
            decimals: 18,
          },
          rpcUrls: [settings.rpcUrl],
        },
      ],
    });
    await switchChain();
  }
}
