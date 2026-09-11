import { test, expect } from "@playwright/test";

for (const storageAvailable of [true, false]) {
  test(`terms stay informational across account changes (storage: ${storageAvailable})`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ storageAvailable }) => {
        let account = "0x0000000000000000000000000000000000000001";
        const calls: string[] = [];
        const listeners = new Map<string, Set<() => void>>();
        if (storageAvailable) {
          localStorage.setItem(
            "freelp:consent:" + account,
            JSON.stringify({ hash: "stale", account }),
          );
        } else {
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new Error("storage unavailable");
            },
          });
        }
        const provider = {
          request: async ({ method }: { method: string }) => {
            calls.push(method);
            if (method === "eth_accounts" || method === "eth_requestAccounts")
              return [account];
            if (method === "eth_chainId") return "0x1";
            throw new Error("Unexpected wallet request");
          },
          on: (name: string, fn: () => void) => {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name)!.add(fn);
          },
          removeListener: (name: string, fn: () => void) =>
            listeners.get(name)?.delete(fn),
        };
        Object.defineProperty(window, "testWalletRequests", {
          get: () => calls,
        });
        window.addEventListener("test:accountChanged", () => {
          account = "0x0000000000000000000000000000000000000002";
          listeners.get("accountsChanged")?.forEach((fn) => fn());
        });
        window.addEventListener("eip6963:requestProvider", () =>
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: { uuid: "terms-test", name: "Test wallet" },
                provider,
              },
            }),
          ),
        );
      },
      { storageAvailable },
    );
    await page.route("https://ethereum-rpc.publicnode.com/", async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          jsonrpc: "2.0",
          id: body.id,
          result: body.method === "eth_chainId" ? "0x1" : "0x",
        },
      });
    });
    await page.goto("/#/terms");
    await expect(
      page.getByRole("heading", { name: "No warranties or guarantees" }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByText("Terms version:", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Accept terms", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Connect Test wallet" }).click();
    await page.getByRole("link", { name: "Deploy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Deploy Core", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("test:accountChanged")),
    );
    await page.getByRole("button", { name: "Connect Test wallet" }).click();
    await expect(
      page.getByRole("button", { name: "Deploy Core", exact: true }),
    ).toBeEnabled();
    await page.getByRole("link", { name: "Terms", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Read the MIT license" }),
    ).toHaveAttribute("href", "./licenses/freelp.txt");
  });
}
