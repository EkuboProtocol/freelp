import { test, expect, type Page } from "@playwright/test";
import {
  createPublicClient,
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
const rpcUrl = "http://127.0.0.1:18545";
// Anvil's documented public development key. Never use on a funded chain.
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const client = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
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
    const amount = (value: number) =>
      missingDecimals
        ? (BigInt(value) * 10n ** 18n).toString()
        : value.toString();
    const deploymentStatus = (success: string) =>
      missingDecimals ? "Deployment verification RPC unavailable" : success;
    const core = zeroAddress;
    const manager = zeroAddress;
    const tokens = [
      native ? zeroAddress : await deploy(tokenArtifact, [account.address]),
      await deploy(tokenArtifact, [account.address]),
    ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    const unexpected: string[] = [];
    let verificationFailure: "core" | "manager" | undefined = missingDecimals
      ? "core"
      : undefined;
    let deployedCore: string = zeroAddress;
    function failsCodeRead(method: string, address: string) {
      return (
        method === "eth_getCode" &&
        !!verificationFailure &&
        (verificationFailure === "core" ||
          address.toLowerCase() !== deployedCore.toLowerCase())
      );
    }
    page.on("request", (request) => {
      const url = request.url();
      if (
        !url.startsWith("http://127.0.0.1:14173") &&
        !url.startsWith(rpcUrl) &&
        !url.startsWith("data:")
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
      page.getByRole("button", { name: "Review and deploy new Core" }),
    ).toBeDisabled();
    await page.getByRole("link", { name: "Terms", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Accept terms", exact: true })
      .click();
    await page.getByRole("link", { name: "Deploy", exact: true }).click();
    await page
      .getByRole("button", { name: "Review and deploy new Core" })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      deploymentStatus("Core deployed and verified:"),
      { timeout: 30000 },
    );
    deployedCore = await page.evaluate(
      () => JSON.parse(localStorage.getItem("freelp:settings")!).core,
    );
    expect(deployedCore).not.toBe(zeroAddress);
    verificationFailure = missingDecimals ? "manager" : undefined;
    if (missingDecimals) {
      await page.reload();
      await page.getByRole("button", { name: "Connect Local wallet" }).click();
      await expect(
        page.getByText(deployedCore, { exact: true }).first(),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Review and deploy position manager" })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      deploymentStatus("Position manager deployed and verified:"),
      { timeout: 30000 },
    );
    verificationFailure = undefined;
    if (missingDecimals) {
      await page.reload();
      await page.getByRole("button", { name: "Connect Local wallet" }).click();
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page
        .getByRole("button", { name: "Verify contracts", exact: true })
        .click();
      await expect(page.locator(".status[role=status]")).toContainText(
        "match the bundled contract artifacts",
      );
    }
    await deployFetchers(page, missingDecimals, native);
    const deployedManager = await page.evaluate(
      () => JSON.parse(localStorage.getItem("freelp:settings")!).manager as Hex,
    );
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await page.getByText("Advanced pool settings", { exact: true }).click();
    await page.getByLabel("Token 0 address").fill(tokens[0]);
    await page.getByLabel("Token 1 address").fill(tokens[1]);
    await checkTokenImports(page, tokens, missingDecimals, native);
    await page.getByLabel("Maximum token 0 amount").fill(amount(1));
    await page.getByLabel("Maximum token 1 amount").fill(amount(1));
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
    await expect(page.getByText("No positions in this manager.")).toBeVisible();
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
    await expect(page.getByText("No positions in this manager.")).toBeVisible();
    expect(unexpected).toEqual([]);
    expect(await client.getBalance({ address: deployedManager })).toBe(0n);
  });

async function deployFetchers(
  page: Page,
  missingDecimals: boolean,
  native: boolean,
) {
  if (missingDecimals || native) return;
  for (const kind of [
    "QuoteDataFetcher",
    "CoreDataFetcher",
    "TokenDataFetcher",
  ]) {
    await page
      .getByRole("button", { name: `Deploy ${kind}`, exact: true })
      .click();
    await expect(page.locator(".status[role=status]")).toContainText(
      `${kind} deployed and verified:`,
      { timeout: 30000 },
    );
  }
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
  await expect(page.getByText("Existing pool", { exact: true })).toBeVisible();
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
    await dialog.getByRole("button", { name: "Read token from chain" }).click();
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
