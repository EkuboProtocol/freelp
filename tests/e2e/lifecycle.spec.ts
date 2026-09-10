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
async function approveDeposits(page: Page, manager: Hex, tokens: Hex[]) {
  const buttons = page.getByRole("button", {
    name: /^(Reset TT approval|Approve TT)$/,
  });
  for (let i = 0; i < 5; i++) {
    const allowances = await Promise.all(
      tokens.map((address) =>
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
    await expect(page.getByLabel("Token 0 maximum")).toHaveValue("2");
  }
  throw new Error("Approvals did not converge");
}
test("RPC-only LP lifecycle with terms enforced", async ({ page }) => {
  const core = zeroAddress;
  const manager = zeroAddress;
  const tokens = [
    await deploy(tokenArtifact, [account.address]),
    await deploy(tokenArtifact, [account.address]),
  ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const unexpected: string[] = [];
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
    if (methods.some((v) => v.method === "eth_getLogs"))
      throw new Error("Historical logs forbidden");
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
  await page.getByRole("button", { name: "Accept terms", exact: true }).click();
  await page.getByRole("link", { name: "Deploy", exact: true }).click();
  await page
    .getByRole("button", { name: "Review and deploy new Core" })
    .click();
  await expect(page.locator(".status[role=status]")).toContainText(
    "Core deployed and verified:",
    { timeout: 30000 },
  );
  await page
    .getByRole("button", { name: "Review and deploy position manager" })
    .click();
  await expect(page.locator(".status[role=status]")).toContainText(
    "Position manager deployed and verified:",
    { timeout: 30000 },
  );
  const deployedManager = await page.evaluate(
    () => JSON.parse(localStorage.getItem("freelp:settings")!).manager as Hex,
  );
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Token 0 address").fill(tokens[0]);
  await page.getByLabel("Token 1 address").fill(tokens[1]);
  await page.getByRole("button", { name: "Preview position" }).click();
  await expect(
    page.getByRole("heading", { name: "Deposit preview" }),
  ).toBeVisible();
  for (let i = 0; i < 2; i++) {
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
  await page.reload();
  await page.getByRole("button", { name: "Connect Local wallet" }).click();
  await page.getByRole("button", { name: "#1", exact: true }).click();
  const before = (await client.readContract({
    address: deployedManager,
    abi: managerArtifact.abi as Abi,
    functionName: "positionAmounts",
    args: [1n],
  })) as { liquidity: bigint };
  await page.getByLabel("Token 0 maximum").fill("2");
  await page.getByLabel("Token 1 maximum").fill("2");
  await approveDeposits(page, deployedManager, tokens);
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
  await page.getByRole("button", { name: "Transfer NFT to recipient" }).click();
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
  await page.getByRole("button", { name: "Collect fees", exact: true }).click();
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
  expect(
    await client.getBalance({ address: zeroAddress }),
  ).toBeGreaterThanOrEqual(0n);
});
