import { checkSdkParity } from "../support/sdkParity";
import { chainDefinition } from "../../src/chains";
import { rpcEndpoint } from "../../src/chains";
import { NETWORKS } from "../../src/networks";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import {
  parseUnits,
  decodeFunctionData,
  createPublicClient,
  createTestClient,
  erc20Abi,
  createWalletClient,
  http,
  zeroAddress,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import coreArtifact from "../../artifacts/Core.json" with { type: "json" };
import managerArtifact from "../../artifacts/FreeLP.json" with { type: "json" };
import fetcherArtifact from "../../artifacts/FreeLPDataFetcher.json" with { type: "json" };
import {
  DEFAULT_POSITION_DATA_FETCHER,
  DEFAULT_MANAGER,
} from "../../src/deployments";
import tokenArtifact from "../../artifacts/TestToken.json" with { type: "json" };
import {
  CREATE2_FACTORY,
  FACTORY_RUNTIME,
  deploymentAddress,
  prepareDeployment,
} from "../../src/deterministic";
const rpcUrl = "http://127.0.0.1:18545";
function transactionStatus(page: Page) {
  return page.locator(
    "dialog[open] .status[role=status], body:not(:has(dialog[open])) .notification-toast .status[role=status]",
  );
}
// Anvil's documented public development key. Never use on a funded chain.
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const client = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
const testClient = createTestClient({
  mode: "anvil",
  chain: foundry,
  transport: http(rpcUrl),
});
const wallet = createWalletClient({
  chain: foundry,
  transport: http(rpcUrl),
  account,
});
async function deploy(
  artifact: typeof coreArtifact | typeof managerArtifact | typeof tokenArtifact,
  args: unknown[] = [],
) {
  const hash = await wallet.deployContract({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode as Hex,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("Deploy failed");
  return receipt.contractAddress;
}
async function approveDeposits(
  page: Page,
  manager: Hex,
  tokens: Hex[],
  amount: string,
  missingDecimals: boolean,
  batch: boolean,
) {
  await expect(page.getByTestId("position-amount-0")).not.toHaveValue("");
  if (batch) {
    await expect(
      page.getByRole("button", { name: "Add liquidity", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /^(Reset TT approval|Approve TT)$/ }),
    ).toHaveCount(0);
    return;
  }
  const required = await Promise.all(
    tokens
      .filter((address) => address !== zeroAddress)
      .map(async (address) => {
        const index = tokens.indexOf(address);
        const decimals = missingDecimals
          ? 0
          : await client.readContract({
              address,
              abi: erc20Abi,
              functionName: "decimals",
            });
        return parseUnits(
          await page.getByTestId(`position-amount-${index}`).inputValue(),
          decimals,
        );
      }),
  );
  const buttons = page.getByRole("button", {
    name: /^(Reset TT approval|Approve TT)$/,
  });
  for (let i = 0; i < 5; i++) {
    const allowances = await Promise.all(
      tokens
        .filter((address) => address !== zeroAddress)
        .map((address) =>
          client.readContract({
            address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account.address, manager],
          }),
        ),
    );
    const labels = allowances
      .filter((amount, index) => amount < required[index])
      .map((amount) => (amount === 0n ? "Approve TT" : "Reset TT approval"));
    await expect(buttons).toHaveText(labels);
    if (!labels.length) {
      await expect(
        page.getByRole("button", { name: "Add liquidity", exact: true }),
      ).toBeEnabled();
      return;
    }
    await expect(
      page.getByRole("button", { name: "Add liquidity", exact: true }),
    ).toBeDisabled();
    const status = transactionStatus(page);
    const previous = (await status.allTextContents()).join("");
    await buttons.first().click();
    await expect(status).not.toHaveText(previous);
    await expect(status).toContainText("Confirmed:", { timeout: 30000 });
    await expect(page.getByTestId("position-amount-1")).toHaveValue(amount);
  }
  throw new Error("Approvals did not converge");
}
for (const { missingDecimals, native, batch } of [
  { missingDecimals: false, native: false, batch: false },
  { missingDecimals: false, native: false, batch: true },
  { missingDecimals: false, native: true, batch: false },
])
  test(`RPC-only LP lifecycle without terms acceptance (missing decimals: ${missingDecimals}, native: ${native}, batch: ${batch})`, async ({
    page,
  }) => {
    await testClient.request({ method: "anvil_reset", params: [] });
    await testClient.setCode({
      address: CREATE2_FACTORY,
      bytecode: FACTORY_RUNTIME,
    });
    const amount = (value: number) =>
      missingDecimals
        ? (BigInt(value) * 10n ** 18n).toString()
        : value.toString();
    const core = "0x00000000000014aA86C5d3c41765bb24e11bd701";
    const manager = DEFAULT_MANAGER;
    const tokens = [
      native ? zeroAddress : await deploy(tokenArtifact, [account.address]),
      await deploy(tokenArtifact, [account.address]),
    ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    const unexpected: string[] = [];
    let verificationFailure: "core" | "manager" | undefined;
    let deployedCore: string = zeroAddress;
    function failsCodeRead(method: string, address: string) {
      return (
        method === "eth_getCode" &&
        !!verificationFailure &&
        (verificationFailure === "core" ||
          address.toLowerCase() !== deployedCore.toLowerCase())
      );
    }
    for (const network of NETWORKS)
      await page.route(
        (url) =>
          url.href.replace(/\/$/, "") ===
          rpcEndpoint(network).replace(/\/$/, ""),
        async (route) => {
          const body = route.request().postDataJSON();
          await route.fulfill({
            json: { jsonrpc: "2.0", id: body.id, result: "0x" },
          });
        },
      );
    page.on("request", (request) => {
      const url = request.url();
      const parsed = new URL(url);
      if (parsed.protocol === "data:") return;
      if (
        request.method() === "GET" &&
        parsed.origin === "http://127.0.0.1:14173" &&
        (parsed.pathname === "/" ||
          /^\/(assets\/[^/]+\.(js|css)|favicon\.svg)$/.test(parsed.pathname))
      )
        return;
      const endpoints = [rpcUrl, ...NETWORKS.map(rpcEndpoint)].map(
        (endpoint) => new URL(endpoint).href,
      );
      if (request.method() === "POST" && endpoints.includes(parsed.href))
        return;
      unexpected.push(url);
    });
    await page.route(`${rpcUrl}/`, async (route) => {
      const body = route.request().postDataJSON();
      const methods = Array.isArray(body) ? body : [body];
      methods.forEach((request) => assertReadOnlyRpc(request, manager));
      if (failsCodeRead(body.method, body.params?.[0])) {
        await route.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32000,
              message: "Deployment verification RPC unavailable",
            },
          },
        });
        return;
      }
      if (methods.some((v) => v.method === "eth_getLogs"))
        throw new Error("Historical logs forbidden");
      if (
        missingDecimals &&
        !Array.isArray(body) &&
        body.method === "eth_call" &&
        body.params[0].data === "0x313ce567"
      ) {
        await route.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32000, message: "decimals unavailable" },
          },
        });
        return;
      }
      await route.continue();
    });
    await page.addInitScript(
      ({ rpcUrl, account, core, manager, batch }) => {
        if (!localStorage.getItem("freelp:settings"))
          localStorage.setItem(
            "freelp:settings",
            JSON.stringify({
              rpcUrl,
              chainId: 31337,
              core,
              manager,
              nativeSymbol: "ETH",
            }),
          );
        const receipts: Record<string, unknown>[] = [];
        let batchCount = 0;
        const requestRpc = async (method: string, params: unknown[]) => {
          const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          return data.result;
        };
        async function receiptFor(hash: string) {
          for (let i = 0; i < 200; i++) {
            const receipt = await requestRpc("eth_getTransactionReceipt", [
              hash,
            ]);
            if (receipt) return receipt;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          throw new Error("Test wallet receipt timed out");
        }
        async function requestBatch(method: string, params?: unknown[]) {
          if (method === "wallet_getCapabilities")
            return { "0x7a69": { atomic: { status: "unsupported" } } };
          if (method === "wallet_switchEthereumChain") return null;
          if (method === "wallet_sendCalls") {
            const args = params![0] as {
              calls: Record<string, unknown>[];
              atomicRequired?: boolean;
            };
            if (args.atomicRequired)
              throw new Error("Atomic execution must not be required");
            receipts.length = 0;
            for (const call of args.calls) {
              const hash = await requestRpc("eth_sendTransaction", [
                { ...call, from: account, gas: "0x989680" },
              ]);
              receipts.push(await receiptFor(hash));
            }
            batchCount++;
            sessionStorage.setItem("test:batchCount", String(batchCount));
            return { id: "0x1234" };
          }
          if (method === "wallet_getCallsStatus")
            return {
              id: "0x1234",
              version: "2.0.0",
              chainId: "0x7a69",
              atomic: false,
              status: 200,
              receipts,
            };
          throw new Error("Unexpected wallet batch method");
        }
        const provider = {
          request: async ({
            method,
            params,
          }: {
            method: string;
            params?: unknown[];
          }) => {
            if (method === "eth_requestAccounts" || method === "eth_accounts")
              return [account];
            if (batch && method.startsWith("wallet_"))
              return requestBatch(method, params);
            const response = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method,
                params: params ?? [],
              }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data.result;
          },
        };
        window.addEventListener("eip6963:requestProvider", () =>
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: { uuid: "test-wallet", name: "Local wallet" },
                provider,
              },
            }),
          ),
        );
      },
      { rpcUrl, account: account.address, core, manager, batch },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Connect Local wallet" }).click();
    await openDeployPage(page, batch);
    if (missingDecimals) {
      verificationFailure = "core";
      await page.reload();
      await page.getByRole("button", { name: "Connect Local wallet" }).click();
      await expect(
        page.getByRole("button", { name: "Deploy Core", exact: true }),
      ).toBeDisabled();
      await expect(
        page
          .getByText("Unable to read this address. Deployment is disabled.")
          .first(),
      ).toBeVisible();
      verificationFailure = undefined;
      await page
        .getByRole("button", { name: "Refresh status" })
        .first()
        .click();
    }
    if (batch) {
      await page
        .getByRole("button", { name: "Deploy all", exact: true })
        .click();
      await expect(transactionStatus(page)).toContainText(
        "Deployed all required contracts.",
        { timeout: 30000 },
      );
      await expect(
        page.getByRole("button", { name: "Deploy all", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByText(
          "All contracts are deployed. Now enable this network in Networks.",
        ),
      ).toBeVisible();
      deployedCore = core;
    } else {
      await expect(
        page.getByRole("button", { name: "Deploy all", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Deploy Core", exact: true })
        .click();
      await expect(transactionStatus(page)).toContainText("Deployed Core at", {
        timeout: 30000,
      });
      deployedCore = await page.evaluate(
        () => JSON.parse(localStorage.getItem("freelp:settings")!).core,
      );
      expect(deployedCore).toBe("0x00000000000014aA86C5d3c41765bb24e11bd701");
      await expect(
        page.getByRole("button", { name: "Deploy Core", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Deploy PoolKeyIndex", exact: true })
        .click();
      await expect(transactionStatus(page)).toContainText(
        "Deployed PoolKeyIndex at",
        { timeout: 30000 },
      );
      await expect(
        page.getByRole("button", { name: "Deploy PoolKeyIndex", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", {
          name: "Deploy FreeLPMetadataRenderer",
          exact: true,
        })
        .click();
      await expect(transactionStatus(page)).toContainText(
        "Deployed FreeLPMetadataRenderer at",
        { timeout: 30000 },
      );
      await page
        .getByRole("button", { name: "Deploy FreeLP", exact: true })
        .click();
      await expect(transactionStatus(page)).toContainText(
        "Deployed FreeLP at",
        {
          timeout: 30000,
        },
      );
      await expect(
        page.getByRole("button", { name: "Deploy FreeLP", exact: true }),
      ).toHaveCount(0);
    }
    expect(deploymentAddress("FreeLP", deployedCore as Hex)).toBe(
      DEFAULT_MANAGER,
    );
    await expect(
      prepareDeployment(
        {
          rpcUrl,
          chainId: 31337,
          core: deployedCore as Hex,
          manager: zeroAddress,
          nativeSymbol: "ETH",
        },
        "FreeLP",
      ),
    ).rejects.toThrow("already deployed");
    await deployFetchers(page, batch);
    await expect(
      page.getByRole("button", { name: "Refresh status" }),
    ).toHaveCount(0);
    await enableAnvil(page, batch);
    await checkSdkParity(tokens);
    const deployedManager = await page.evaluate(
      () => JSON.parse(localStorage.getItem("freelp:settings")!).manager as Hex,
    );
    const deployedFetcher = DEFAULT_POSITION_DATA_FETCHER;
    await expect(page.getByText("Pool details", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText(/Tick range:/)).toHaveCount(0);
    await page.getByRole("link", { name: "Positions", exact: true }).click();
    await page
      .getByRole("link", { name: "Create position", exact: true })
      .click();
    await selectAnvil(page, batch);
    await checkTokenImports(page, tokens, missingDecimals, native);
    await page.getByLabel("Initial price").fill("1");
    if (!missingDecimals && !native) {
      await page.getByTestId("deposit-amount-0").fill("1");
      await expect(
        page.getByRole("heading", { name: "Deposit preview", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await page.screenshot({
        path: test.info().outputPath("create-preview.png"),
        fullPage: true,
      });
      const paired = await page.getByTestId("deposit-amount-1").inputValue();
      expect(Number(paired)).toBeGreaterThan(0);
      await page.getByTestId("deposit-amount-0").fill("0.5");
      await expect(page.getByTestId("deposit-amount-1")).not.toHaveValue(
        paired,
      );
    }
    await expect(
      page.getByLabel("Calculate the matching token amount"),
    ).toHaveCount(0);
    await page.getByTestId("deposit-amount-0").fill(amount(1));
    await page.getByTestId("deposit-amount-1").fill(amount(1));
    await expect(
      page.getByRole("heading", { name: "Deposit preview" }),
    ).toBeVisible();
    for (let i = 0; i < approvalCount(batch, native); i++) {
      await page
        .getByRole("button", { name: "Approve TT", exact: true })
        .first()
        .click();
      await expect(transactionStatus(page)).toContainText("Confirmed:", {
        timeout: 30000,
      });
      await expect(
        page.getByRole("heading", { name: "Deposit preview" }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Create position", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Manage position #1", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole("link", { name: "Positions", exact: true }).click();
    await page
      .getByRole("link", { name: "Create position", exact: true })
      .click();
    await checkTokenImports(page, tokens, missingDecimals, native);
    if (batch)
      expect(
        await page.evaluate(() =>
          Number(sessionStorage.getItem("test:batchCount")),
        ),
      ).toBe(2);
    await checkPoolChart(page, missingDecimals, native);
    await captureChart(page, missingDecimals, native);
    await checkCustomSpacing(page, missingDecimals, native);
    await page.getByTestId("deposit-amount-0").fill(amount(1));
    await page.getByTestId("deposit-amount-1").fill(amount(1));
    await expect(page.getByLabel("Initial price")).toHaveCount(0);
    await page.getByText("Price and pool details", { exact: true }).click();
    await expect(
      page.getByText("Existing pool: the initial-price input is ignored."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Positions", exact: true }).click();
    await seedIncompleteActivity(page);
    await page.reload();
    await page.getByRole("button", { name: "Connect Local wallet" }).click();
    await page.getByRole("link", { name: "Positions", exact: true }).click();
    await page
      .getByRole("link", { name: "Manage position #1", exact: true })
      .click();
    await expect(page.locator(".portfolio-positions")).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "All positions", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.locator(".portfolio-positions")).toBeVisible();
    await page.goForward();
    await capturePosition(page);
    await expect(
      page.getByRole("complementary", { name: "Transaction activity" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Collect fees", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Add liquidity to position", exact: true })
      .click();
    await expect(page.getByTestId("position-amount-1")).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("manage-position.png"),
      fullPage: true,
    });
    const before = (await client.readContract({
      address: deployedFetcher,
      abi: fetcherArtifact.abi as Abi,
      functionName: "positionAmounts",
      args: [deployedManager, 1n],
    })) as { liquidity: bigint };
    if (missingDecimals)
      await expect(
        page
          .getByText(
            "Decimals unavailable: displayed and deposit amounts use raw integer units.",
          )
          .first(),
      ).toBeVisible();
    await page.getByTestId("position-amount-1").fill(amount(2));
    await approveDeposits(
      page,
      deployedManager,
      tokens,
      amount(2),
      missingDecimals,
      batch,
    );
    await page
      .getByRole("button", { name: "Add liquidity", exact: true })
      .click();
    await expect(transactionStatus(page)).toContainText("Confirmed:", {
      timeout: 30000,
    });
    await expect
      .poll(
        async () => {
          const result = (await client.readContract({
            address: deployedFetcher,
            abi: fetcherArtifact.abi as Abi,
            functionName: "positionAmounts",
            args: [deployedManager, 1n],
          })) as { liquidity: bigint };
          return result.liquidity;
        },
        { timeout: 30000 },
      )
      .toBeGreaterThan(before.liquidity);
    await expect(
      page.getByRole("button", { name: "Transfer NFT to recipient" }),
    ).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Connect Local wallet" }).click();
    await page.getByRole("link", { name: "Positions", exact: true }).click();
    await page
      .getByRole("link", { name: "Manage position #1", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Collect fees", exact: true }),
    ).toBeDisabled();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    await page.getByLabel("Withdraw percentage").fill("50");
    await expect(
      page.getByText("Estimated receipt", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Minimum receipt", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Slippage (basis points)")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Withdraw liquidity and fees" })
      .click();
    await expect(transactionStatus(page)).toContainText("Confirmed:");
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    await page.getByLabel("Withdraw percentage").fill("100");
    await page
      .getByRole("button", { name: "Withdraw liquidity and fees" })
      .click();
    await expect(
      page.getByText("No FreeLP positions found on the enabled networks."),
    ).toBeVisible();
    await checkStableCreation(
      page,
      deployedManager,
      tokens,
      missingDecimals,
      native,
    );
    expect(unexpected).toEqual([]);
    expect(await client.getBalance({ address: deployedManager })).toBe(0n);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("freelp:transaction-journal")!,
          ).entries.filter((entry: { id: string }) =>
            entry.id.startsWith("stale-"),
          ).length,
      ),
    ).toBe(4);
  });

async function seedIncompleteActivity(page: Page) {
  await page.evaluate((account) => {
    const key = "freelp:transaction-journal";
    if (localStorage.getItem(key) !== null)
      throw new Error("Transactions must not create browser history");
    const journal = { version: 1, entries: [] as object[] };
    journal.entries.push(
      ...["awaiting wallet", "submitted", "confirming", "unknown"].map(
        (state, index) => ({
          id: `stale-${index}`,
          chainId: 31337,
          account,
          count: 1,
          state,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          // Include both lost wallet responses and identifiers without receipts.
          ...(index === 1 ? { hash: `0x${"12".repeat(32)}` } : {}),
          ...(index === 2 ? { batchId: "old-wallet-batch" } : {}),
        }),
      ),
    );
    localStorage.setItem(key, JSON.stringify(journal));
  }, account.address);
}

function assertReadOnlyRpc(
  request: { method: string; params: { to?: string; data: Hex }[] },
  manager: string,
) {
  expect(["eth_simulateV1", "eth_estimateGas"]).not.toContain(request.method);
  if (request.method !== "eth_call") return;
  const call = request.params[0];
  expect(call.to?.toLowerCase()).not.toBe(CREATE2_FACTORY.toLowerCase());
  if (call.to?.toLowerCase() !== manager.toLowerCase()) return;
  const { functionName } = decodeFunctionData({
    abi: managerArtifact.abi,
    data: call.data,
  });
  expect([
    "createPosition",
    "addLiquidity",
    "withdraw",
    "multicall",
  ]).not.toContain(functionName);
}

/** Deployment never enables a network: batch runs disable Anvil first. */
async function openDeployPage(page: Page, batch: boolean) {
  if (batch) {
    await page.getByRole("link", { name: "Networks", exact: true }).click();
    await page.getByLabel("Search networks").fill("Anvil");
    await page
      .getByRole("checkbox", { name: "Enable Anvil", exact: true })
      .uncheck();
    await page
      .getByRole("link", { name: "Deploy contracts on Anvil" })
      .click();
  } else {
    await page.evaluate(() => {
      location.hash = "#/deploy/31337";
    });
  }
  await expect(page.locator("p", { hasText: "Network:" })).toContainText(
    batch ? "Anvil (31337) · not enabled" : "Anvil (31337) · enabled",
  );
}

/** Explicit enable after Deploy all re-verifies the chain code. */
async function enableAnvil(page: Page, batch: boolean) {
  if (!batch) return;
  await page
    .getByRole("link", { name: "Networks", exact: true })
    .first()
    .click();
  await page.getByLabel("Search networks").fill("Anvil");
  const foundry = page.getByRole("checkbox", {
    name: "Enable Anvil",
    exact: true,
  });
  await expect(foundry).not.toBeChecked();
  await foundry.click();
  await expect(foundry).toBeChecked();
  await expect(
    page.locator(".network-row", { hasText: "Anvil" }),
  ).toContainText("Ready");
}

async function selectAnvil(page: Page, batch: boolean) {
  if (batch)
    await page.getByLabel("Network", { exact: true }).selectOption("31337");
}

async function deployFetchers(page: Page, alreadyDeployed: boolean) {
  if (alreadyDeployed) return;
  await page
    .getByRole("button", { name: "Deploy FreeLPDataFetcher", exact: true })
    .click();
  await expect(transactionStatus(page)).toContainText(
    "Deployed FreeLPDataFetcher at",
    { timeout: 30000 },
  );
}

async function checkPoolChart(
  page: Page,
  missingDecimals: boolean,
  native: boolean,
) {
  if (missingDecimals || native) return;
  await expect(
    page.getByRole("img", { name: "Pool token amounts by price" }),
  ).toBeVisible({ timeout: 30000 });
  const heights = await page
    .locator(
      '.liquidity-chart g rect[fill="#111"], .liquidity-chart g rect[fill="#999"]',
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute("height"))),
    );
  expect(heights.some((height) => height > 0)).toBe(true);
}

async function checkTokenImports(
  page: Page,
  tokens: Hex[],
  _missingDecimals: boolean,
  native: boolean,
) {
  for (const [index, address] of tokens.entries()) {
    await page
      .getByRole("button", {
        name: index === 0 ? "Select first token" : "Select second token",
      })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Search tokens or paste an address").fill(address);
    if (address === zeroAddress) {
      await dialog
        .locator(".token-option")
        .filter({ hasText: chainDefinition(31337).name })
        .first()
        .click();
      continue;
    }
    await dialog
      .getByRole("button", {
        name: `Read token on ${chainDefinition(31337).name}`,
      })
      .click();
    await dialog
      .getByRole("button", { name: "Import token", exact: true })
      .click();
  }
  if (native) return;
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("freelp:tokens:31337")!),
  );
  expect(
    saved.filter((token: { symbol: string }) => token.symbol === "TT"),
  ).toHaveLength(2);
  expect(
    await page.evaluate(() => localStorage.getItem("freelp:tokens:8453")),
  ).toBeNull();
}

async function captureChart(
  page: Page,
  missingDecimals: boolean,
  native: boolean,
) {
  if (!missingDecimals && !native) {
    await page.screenshot({
      path: test.info().outputPath("liquidity-chart-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: test.info().outputPath("liquidity-chart-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
}

async function checkCustomSpacing(
  page: Page,
  missingDecimals: boolean,
  native: boolean,
) {
  if (missingDecimals || native) return;
  await page.getByRole("switch", { name: "Advanced", exact: true }).click();
  const control = page.locator(".tick-spacing-control");
  await control.locator("summary").click();
  await control.getByLabel("Enter exact ticks").check();
  await control.getByLabel("Tick spacing (ticks)").fill("777");
  await control.getByRole("button", { name: "Apply tick spacing" }).click();
  await expect(control.locator("summary")).toContainText("0.0777%");
  await expect(page.getByLabel("Initial price")).toBeVisible();
  await expect(page.locator(".pool-options")).toBeHidden();
  await control.locator("summary").click();
  await control.getByRole("button", { name: "0.6%", exact: true }).click();
  await page.getByRole("switch", { name: "Advanced", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Pool token amounts by price" }),
  ).toBeVisible();
}

async function checkStableCreation(
  page: Page,
  manager: Hex,
  tokens: Hex[],
  missingDecimals: boolean,
  native: boolean,
) {
  if (missingDecimals || native) return;
  for (const address of tokens) {
    const hash = await wallet.writeContract({
      address,
      abi: erc20Abi,
      functionName: "approve",
      args: [manager, 2n * 10n ** 18n],
    });
    await client.waitForTransactionReceipt({ hash });
  }
  await page.reload();
  await page.getByRole("button", { name: "Connect Local wallet" }).click();
  await page.getByRole("link", { name: "Positions", exact: true }).click();
  await page
    .getByRole("link", { name: "Create position", exact: true })
    .click();
  await checkTokenImports(page, tokens, false, false);
  await page.getByRole("switch", { name: "Advanced", exact: true }).click();
  await page.getByLabel("Pool type", { exact: true }).selectOption("stable");
  await page.getByLabel("Enter exact amount").check();
  await page.getByLabel("Exact fee (uint64)").fill("123456789");
  await page.getByLabel("Amplification exponent").fill("10");
  await page.getByLabel("Center tick (multiple of 16)").fill("16");
  await page.getByLabel("Initial price").fill("1");
  await page.getByTestId("deposit-amount-0").fill("1");
  await expect(
    page.getByRole("button", { name: "Create position", exact: true }),
  ).toBeEnabled();
  const stableHash = new URL(page.url()).hash;
  await page
    .getByRole("button", { name: "Create position", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Manage position #2", exact: true })
    .click();
  const descriptor = (await client.readContract({
    address: DEFAULT_POSITION_DATA_FETCHER,
    abi: fetcherArtifact.abi as Abi,
    functionName: "descriptor",
    args: [manager, 2n],
  })) as { poolKey: { config: Hex }; tickLower: number; tickUpper: number };
  expect(BigInt(descriptor.poolKey.config)).toBe(
    (123456789n << 32n) | (10n << 24n) | 1n,
  );
  expect(descriptor.tickLower).toBe(-86627);
  expect(descriptor.tickUpper).toBe(86659);
  await page.evaluate((hash) => {
    location.hash = hash;
  }, stableHash);
  await expect(
    page.getByRole("img", { name: "Pool token amounts by price" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("stableswap-create.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Positions", exact: true }).click();
  await page
    .getByRole("link", { name: "Manage position #2", exact: true })
    .click();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page.getByLabel("Withdraw percentage").fill("100");
  await page
    .getByRole("button", { name: "Withdraw liquidity and fees" })
    .click();
  await expect(
    page.getByText("No FreeLP positions found on the enabled networks."),
  ).toBeVisible();
}

function approvalCount(batch: boolean, native: boolean) {
  return batch ? 0 : native ? 1 : 2;
}

async function capturePosition(page: Page) {
  await page.getByText("View position NFT", { exact: true }).click();
  const artwork = page.getByRole("img", { name: /Position NFT artwork/ });
  await expect(artwork).toBeVisible();
  await expect(artwork).toHaveJSProperty("naturalWidth", 640);
  await page.getByText("View position NFT", { exact: true }).click();
  await expect(page.locator(".current-price strong").last()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Burn|Transfer NFT/ }),
  ).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: test.info().outputPath(`position-summary-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}
