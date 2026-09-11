import { NETWORKS } from "../../src/networks";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import {
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
import tokenArtifact from "../../artifacts/TestToken.json" with { type: "json" };
import {
  CREATE2_FACTORY,
  FACTORY_RUNTIME,
  deploymentAddress,
  prepareDeployment,
} from "../../src/deterministic";
const rpcUrl = "http://127.0.0.1:18545";
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
) {
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
      .filter((amount) => amount < 2n * 10n ** 18n)
      .map((amount) => (amount === 0n ? "Approve TT" : "Reset TT approval"));
    await expect(buttons).toHaveText(labels);
    if (!labels.length) return;
    const status = page.locator(".status[role=status]");
    const previous = (await status.allTextContents()).join("");
    await buttons.first().click();
    await expect(status).not.toHaveText(previous);
    await expect(status).toContainText("Confirmed:", { timeout: 30000 });
    await expect(page.getByLabel("Token 0 maximum")).toHaveValue(amount);
  }
  throw new Error("Approvals did not converge");
}
for (const { missingDecimals, native } of [
  { missingDecimals: false, native: false },
  { missingDecimals: true, native: false },
  { missingDecimals: false, native: true },
])
  test(`RPC-only LP lifecycle with terms enforced (missing decimals: ${missingDecimals}, native: ${native})`, async ({
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
    const core = zeroAddress;
    const manager = zeroAddress;
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
          url.href.replace(/\/$/, "") === network.rpcUrl.replace(/\/$/, ""),
        async (route) => {
          const body = route.request().postDataJSON();
          await route.fulfill({
            json: { jsonrpc: "2.0", id: body.id, result: "0x" },
          });
        },
      );
    page.on("request", (request) => {
      const url = request.url();
      if (
        !url.startsWith("http://127.0.0.1:14173") &&
        !url.startsWith(rpcUrl) &&
        !url.startsWith("data:") &&
        !NETWORKS.some((network) => url.startsWith(network.rpcUrl))
      )
        unexpected.push(url);
    });
    await page.route(`${rpcUrl}/`, async (route) => {
      const body = route.request().postDataJSON();
      const methods = Array.isArray(body) ? body : [body];
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
      ({ rpcUrl, account, core, manager }) => {
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
      { rpcUrl, account: account.address, core, manager },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Connect Local wallet" }).click();
    await page.getByRole("link", { name: "Deploy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Deploy Core", exact: true }),
    ).toBeDisabled();
    await page.getByRole("link", { name: "Terms", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Accept terms", exact: true })
      .click();
    await page.getByRole("link", { name: "Deploy", exact: true }).click();
    if (missingDecimals) {
      verificationFailure = "core";
      await page.reload();
      await page.getByRole("button", { name: "Connect Local wallet" }).click();
      await expect(
        page.getByRole("button", { name: "Deploy Core", exact: true }),
      ).toBeDisabled();
      await expect(
        page
          .getByText("Unable to verify this address. Deployment is disabled.")
          .first(),
      ).toBeVisible();
      verificationFailure = undefined;
      await page
        .getByRole("button", { name: "Refresh status" })
        .first()
        .click();
    }
    await page
      .getByRole("button", { name: "Deploy Core", exact: true })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      "Using Core at",
      { timeout: 30000 },
    );
    deployedCore = await page.evaluate(
      () => JSON.parse(localStorage.getItem("freelp:settings")!).core,
    );
    expect(deployedCore).toBe("0x00000000000014aA86C5d3c41765bb24e11bd701");
    await expect(
      page.getByRole("button", { name: "Deploy Core", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Deploy FreeLP", exact: true })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      "Using FreeLP at",
      { timeout: 30000 },
    );
    await expect(
      page.getByRole("button", { name: "Deploy FreeLP", exact: true }),
    ).toBeDisabled();
    expect(deploymentAddress("FreeLP", deployedCore as Hex)).toBe(
      "0x573af249A268ed80c358dA77986D2e637978A611",
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
    await deployFetchers(page);
    const deployedManager = await page.evaluate(
      () => JSON.parse(localStorage.getItem("freelp:settings")!).manager as Hex,
    );
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await page.getByText("Advanced pool settings", { exact: true }).click();
    await page.getByLabel("Token 0 address").fill(tokens[0]);
    await page.getByLabel("Token 1 address").fill(tokens[1]);
    await checkTokenImports(page, tokens, missingDecimals, native);
    await page.getByLabel("Initial price (new pools only)").fill("1");
    await page.getByLabel("Lower price", { exact: true }).fill("0.99");
    await page.getByLabel("Upper price", { exact: true }).fill("1.01");
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
    await page.getByRole("button", { name: "Preview position" }).click();
    await expect(
      page.getByRole("heading", { name: "Deposit preview" }),
    ).toBeVisible();
    for (let i = 0; i < (native ? 1 : 2); i++) {
      await page
        .getByRole("button", { name: "Approve TT", exact: true })
        .first()
        .click();
      await expect(page.locator(".status[role=status]")).toContainText(
        "Confirmed:",
        {
          timeout: 30000,
        },
      );
      await page.getByRole("button", { name: "Preview position" }).click();
      await expect(
        page.getByRole("heading", { name: "Deposit preview" }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Create position", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "#1", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await page.getByText("Advanced pool settings", { exact: true }).click();
    await page.getByLabel("Token 0 address").fill(tokens[0]);
    await page.getByLabel("Token 1 address").fill(tokens[1]);
    await checkPoolChart(page, missingDecimals, native);
    await captureChart(page, missingDecimals, native);
    await checkCustomSpacing(page, missingDecimals, native);
    await page.getByLabel("Lower price", { exact: true }).fill("0.99");
    await page.getByLabel("Upper price", { exact: true }).fill("1.01");
    await page.getByTestId("deposit-amount-0").fill(amount(1));
    await page.getByTestId("deposit-amount-1").fill(amount(1));
    await page
      .getByLabel("Initial price (new pools only)")
      .fill("ignored for existing pool");
    await page.getByRole("button", { name: "Preview position" }).click();
    await expect(
      page.getByText("Existing pool: the initial-price input is ignored."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Positions", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Connect Local wallet" }).click();
    await page.getByRole("button", { name: "#1", exact: true }).click();
    const before = (await client.readContract({
      address: deployedManager,
      abi: managerArtifact.abi as Abi,
      functionName: "positionAmounts",
      args: [1n],
    })) as { liquidity: bigint };
    if (missingDecimals)
      await expect(
        page
          .getByText(
            "Decimals unavailable: displayed and deposit amounts use raw integer units.",
          )
          .first(),
      ).toBeVisible();
    await page.getByLabel("Token 0 maximum").fill(amount(2));
    await page.getByLabel("Token 1 maximum").fill(amount(2));
    await approveDeposits(page, deployedManager, tokens, amount(2));
    await page
      .getByRole("button", { name: "Add liquidity", exact: true })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      "Confirmed:",
      { timeout: 30000 },
    );
    await expect
      .poll(
        async () => {
          const result = (await client.readContract({
            address: deployedManager,
            abi: managerArtifact.abi as Abi,
            functionName: "positionAmounts",
            args: [1n],
          })) as { liquidity: bigint };
          return result.liquidity;
        },
        { timeout: 30000 },
      )
      .toBeGreaterThan(before.liquidity);
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    await page.getByLabel("Recipient address").fill(recipient);
    await page
      .getByRole("button", { name: "Transfer NFT to recipient" })
      .click();
    await expect(
      page.getByText("No positions found on the available networks."),
    ).toBeVisible();
    expect(
      await client.readContract({
        address: deployedManager,
        abi: managerArtifact.abi as Abi,
        functionName: "ownerOf",
        args: [1n],
      }),
    ).toBe(recipient);
    const returned = await wallet.writeContract({
      account: recipient,
      address: deployedManager,
      abi: managerArtifact.abi as Abi,
      functionName: "transferFrom",
      args: [recipient, account.address, 1n],
    });
    await client.waitForTransactionReceipt({ hash: returned });
    await page.reload();
    await page.getByRole("button", { name: "Connect Local wallet" }).click();
    await page.getByRole("button", { name: "#1", exact: true }).click();
    await page
      .getByRole("button", { name: "Collect fees", exact: true })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      "Confirmed:",
    );
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.getByLabel("Withdraw percentage").fill("50");
    await page
      .getByRole("button", { name: "Withdraw liquidity and fees" })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      "Confirmed:",
    );
    await page.getByLabel("Withdraw percentage").fill("100");
    await page
      .getByRole("button", { name: "Withdraw liquidity and fees" })
      .click();
    await expect(
      page.getByRole("button", { name: "Burn empty NFT" }),
    ).toBeEnabled({ timeout: 30000 });
    await page.getByRole("button", { name: "Burn empty NFT" }).click();
    await expect(
      page.getByText("No positions found on the available networks."),
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
  });

async function deployFetchers(page: Page) {
  await page
    .getByRole("button", { name: "Deploy FreeLPDataFetcher", exact: true })
    .click();
  await expect(page.locator(".status[role=status]")).toContainText(
    "Using FreeLPDataFetcher at",
    { timeout: 30000 },
  );
}

async function checkPoolChart(
  page: Page,
  missingDecimals: boolean,
  native: boolean,
) {
  if (missingDecimals || native) return;
  await page.getByRole("button", { name: "Find pools on chain" }).click();
  await expect(
    page.getByRole("img", { name: "Pool liquidity by price" }),
  ).toBeVisible({ timeout: 30000 });
  await page.locator(".pool-edit summary").click();
  await expect(page.getByText("Existing pool", { exact: true })).toBeVisible();
  await page.locator(".pool-edit summary").click();
  const heights = await page
    .locator(".liquidity-chart rect")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute("height"))),
    );
  expect(heights.some((height) => height > 0)).toBe(true);
}

async function checkTokenImports(
  page: Page,
  tokens: Hex[],
  missingDecimals: boolean,
  native: boolean,
) {
  if (missingDecimals || native) return;
  for (const [index, address] of tokens.entries()) {
    await page
      .getByRole("button", {
        name: index === 0 ? "Select first token" : "Select second token",
      })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Search tokens or paste an address").fill(address);
    await dialog
      .getByRole("button", { name: "Read token on Chain 31337" })
      .click();
    await dialog
      .getByRole("button", { name: "Import token", exact: true })
      .click();
  }
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
  const control = page.locator(".tick-spacing-control");
  await control.locator("summary").click();
  await control.getByLabel("Enter exact ticks").check();
  await control.getByLabel("Tick spacing (ticks)").fill("777");
  await control.getByRole("button", { name: "Apply tick spacing" }).click();
  await expect(control.locator("summary")).toContainText("0.0777%");
  await page.getByLabel("Lower price", { exact: true }).fill("0.98");
  await page.getByLabel("Upper price", { exact: true }).fill("1.02");
  await page.getByRole("button", { name: "Find pools on chain" }).click();
  await expect(
    page.getByRole("button", { name: "Find pools on chain" }),
  ).toBeEnabled();
  await expect(page.locator(".pool-options .selected")).toContainText(
    "0.0777%",
  );
  await expect(page.getByLabel("Lower price", { exact: true })).toHaveValue(
    "0.98",
  );
  await expect(page.getByLabel("Upper price", { exact: true })).toHaveValue(
    "1.02",
  );
  await control.locator("summary").click();
  await control.getByRole("button", { name: "0.6%", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Pool liquidity by price" }),
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
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByText("Advanced pool settings", { exact: true }).click();
  await page.getByLabel("Token 0 address").fill(tokens[0]);
  await page.getByLabel("Token 1 address").fill(tokens[1]);
  await page.getByLabel("Pool type", { exact: true }).selectOption("stable");
  await page.locator(".pool-edit summary").click();
  await page.getByLabel("Exact fee (uint64, optional)").fill("123456789");
  await page.locator(".pool-edit summary").click();
  await page.getByLabel("Amplification exponent").fill("10");
  await page.getByLabel("Center tick (multiple of 16)").fill("16");
  await page.getByLabel("Initial price (new pools only)").fill("1");
  await page.getByTestId("deposit-amount-0").fill("1");
  await expect(
    page.getByRole("button", { name: "Create position", exact: true }),
  ).toBeEnabled();
  const stableHash = new URL(page.url()).hash;
  await page
    .getByRole("button", { name: "Create position", exact: true })
    .click();
  await page.getByRole("button", { name: "#2", exact: true }).click();
  const descriptor = (await client.readContract({
    address: manager,
    abi: managerArtifact.abi as Abi,
    functionName: "descriptor",
    args: [2n],
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
    page.getByRole("img", { name: "Pool liquidity by price" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("stableswap-create.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Positions", exact: true }).click();
  await page.getByRole("button", { name: "#2", exact: true }).click();
  await page.getByLabel("Withdraw percentage").fill("100");
  await page
    .getByRole("button", { name: "Withdraw liquidity and fees" })
    .click();
  await expect(
    page.getByRole("button", { name: "Burn empty NFT" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Burn empty NFT" }).click();
  await expect(
    page.getByText("No positions found on the available networks."),
  ).toBeVisible();
}
