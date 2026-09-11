import { fixedSqrtRatioToFloat, toSqrtRatio } from "@ekubo/sdk";
import type { Page } from "@playwright/test";
import { encodeFunctionResult, toFunctionSelector } from "viem";
import { EVM_QUOTE_DATE_FETCHER_V3_ABI } from "../../src/abis/quoteDataFetcher";
export async function mockPoolData(page: Page, initialized = false) {
  await page.route(
    (url) => url.protocol === "https:",
    async (route) => {
      const body = route.request().postDataJSON();
      if (
        body.method !== "eth_call" ||
        !body.params[0].data.startsWith(
          toFunctionSelector(EVM_QUOTE_DATE_FETCHER_V3_ABI[0]),
        )
      )
        return route.fallback();
      const result = encodeFunctionResult({
        abi: EVM_QUOTE_DATE_FETCHER_V3_ABI,
        functionName: "getQuoteData",
        result: [
          {
            tick: 0,
            sqrtRatio: initialized
              ? fixedSqrtRatioToFloat(toSqrtRatio(0, "evm"))
              : 0n,
            liquidity: 0n,
            minTick: -10000,
            maxTick: 10000,
            ticks: [],
          },
        ],
      });
      await route.fulfill({ json: { jsonrpc: "2.0", id: body.id, result } });
    },
  );
}
