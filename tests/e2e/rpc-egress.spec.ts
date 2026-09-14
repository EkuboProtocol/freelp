import { test, expect } from "@playwright/test";
import { rpcEndpoint } from "../../src/chains";
import { NETWORKS } from "../../src/networks";
import { mockDeployments } from "../support/deploymentRpc";
import { mockPoolData } from "../support/poolRpc";

test("navigation and liquidity preview use bundled assets and exact configured RPC endpoints only", async ({
  page,
  baseURL,
}) => {
  const unexpected: string[] = [];
  const rpcUrls = new Set(
    NETWORKS.map((network) => new URL(rpcEndpoint(network)).href),
  );
  const origin = new URL(baseURL!).origin;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && rpcUrls.has(url.href)) return;
    if (
      request.method() === "GET" &&
      url.origin === origin &&
      (url.pathname === "/" ||
        /^\/(assets\/[^/]+\.(js|css)|tokens\/\d+\.json|favicon\.svg)$/.test(
          url.pathname,
        ))
    )
      return;
    unexpected.push(`${request.method()} ${request.url()}`);
  });
  await page.route("https://**", (route) => route.abort());
  await mockDeployments(page);
  await mockPoolData(page, true);
  await page.goto("/");
  for (const route of ["networks", "deploy", "terms", "build"])
    await page.goto(`/#/${route}`);
  await page.goto(
    "/#/create?chain=8453&a=0x0000000000000000000000000000000000000000&b=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );
  await expect(page.locator(".range-section")).toBeVisible();
  await page.getByTestId("deposit-amount-0").fill("0.1");
  await expect(page.getByTestId("deposit-amount-1")).not.toHaveValue("");
  expect(unexpected).toEqual([]);
});
