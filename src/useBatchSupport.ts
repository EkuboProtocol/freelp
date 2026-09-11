import { useEffect, useState } from "react";
import { useSession } from "./session";
import { supportsCalls } from "./walletCalls";
export function useBatchSupport() {
  const { provider, account, settings } = useSession();
  const [result, setResult] = useState<{
    provider: typeof provider;
    account: typeof account;
    chain: number;
    supported: boolean;
  }>();
  useEffect(() => {
    let active = true;
    if (provider && account)
      void supportsCalls(provider, account, settings).then((supported) => {
        if (active)
          setResult({ provider, account, chain: settings.chainId, supported });
      });
    return () => {
      active = false;
    };
  }, [provider, account, settings]);
  return result?.provider === provider &&
    result?.account === account &&
    result?.chain === settings.chainId
    ? result.supported
    : undefined;
}
