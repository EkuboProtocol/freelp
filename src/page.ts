import { report, setStorageBackend } from "./storage";
import { setArtifactFetch } from "./contractDeployment";
import { setCatalogFetch } from "./tokenCatalog";
import type { Provider } from "./types";

// The data module's way to the page (modules/web/index.js): wallets,
// localStorage and the app's own files. Exact hands each source `native`;
// `attach` keeps the latest so library code can reach the page.
export type Native = {
  later(request: Record<string, unknown>): Promise<unknown>;
  watch(topic: string): void;
};
type Failure = { error: { code: number | null; message: string } };
let native: Native | undefined;

export function attach(next: unknown) {
  if (next && typeof (next as Native).later === "function")
    native = next as Native;
}

// False while the build renders a page ahead: there is no page module then.
export function connected() {
  return native !== undefined;
}

export function watch(topic: string) {
  native?.watch(topic);
}

export class PageError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

export async function page<T>(
  op: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!native) throw new PageError("The page is not connected.");
  const reply: unknown = await native.later({ op, ...args });
  if (reply && typeof reply === "object" && "error" in reply) {
    const { code, message } = (reply as Failure).error;
    throw new PageError(message, code ?? undefined);
  }
  return reply as T;
}

// The connected wallet as an EIP-1193 provider: the page forwards its
// allowlisted methods to the wallet the person chose.
export const walletProvider: Provider = {
  async request({ method, params }) {
    return (await page<{ result: unknown }>("request", { method, params }))
      .result;
  },
};

let hydrated: Promise<void> | undefined;
export function ready() {
  return (hydrated ??= page<{
    values: Record<string, string | null>;
    unavailable?: boolean;
  }>("storageSnapshot").then(({ values, unavailable }) => {
    const items = new Map(Object.entries(values));
    if (unavailable)
      report(
        "Browser storage is unavailable. Changes will remain in memory until you reload.",
      );
    setStorageBackend({
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value);
        page("storageSet", { key, value }).catch(() =>
          report(
            "Browser storage is full or unavailable. Changes are active for this session only.",
          ),
        );
      },
    });
    setCatalogFetch((path) => page("asset", { path }));
    setArtifactFetch(async (path) => {
      const file = await page<{ status: number; text: string }>("asset", {
        path,
      });
      if (file.status !== 200)
        throw new PageError("This build's contract artifacts are unavailable.");
      return file.text;
    });
  }));
}
