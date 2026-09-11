import { expect, test } from "bun:test";
import { zeroAddress } from "viem";
import { switchWalletChain } from "../../src/walletNetwork";
const settings = {
  chainId: 31337,
  name: "My local network",
  rpcUrl: "http://127.0.0.1:18545",
  core: zeroAddress,
  manager: zeroAddress,
  nativeSymbol: "ETH",
};
test("unknown wallet networks can be added from the saved configuration", async () => {
  const calls: { method: string; params?: unknown[] }[] = [];
  await switchWalletChain(
    {
      request: async (args) => {
        calls.push(args);
        if (calls.length === 1) throw { code: 4902 };
      },
    },
    settings,
  );
  expect(calls.map((c) => c.method)).toEqual([
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
  ]);
  expect(calls[1].params).toEqual([
    {
      chainId: "0x7a69",
      chainName: settings.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: [settings.rpcUrl],
    },
  ]);
});
test("wallet rejection does not trigger an add-network prompt", async () => {
  let requests = 0;
  await expect(
    switchWalletChain(
      {
        request: async () => {
          requests++;
          throw { code: 4001 };
        },
      },
      settings,
    ),
  ).rejects.toEqual({ code: 4001 });
  expect(requests).toBe(1);
});
