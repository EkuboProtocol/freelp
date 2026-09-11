import { useBatchSupport } from "./useBatchSupport";
import { depositCalls } from "./walletCalls";
import { errorMessage } from "./errors";
import { usePositionDeposit } from "./usePositionDeposit";
import { useEffect, useState } from "react";
import { getAddress, zeroAddress } from "viem";
import { useSession } from "./session";
import { token, managerData, type Token } from "./contracts";
import type { Position } from "./types";
export function usePositionActions(p: Position) {
  const { settings, account, setStatus, send } = useSession();
  const [tokens, setTokens] = useState<[Token, Token]>();
  const batchSupported = useBatchSupport();
  const [recipient, setRecipient] = useState(account ?? "");
  const [portion, setPortion] = useState(100);
  const [slippage, setSlippage] = useState(50);
  const deposit = usePositionDeposit(p, tokens);
  useEffect(() => {
    let active = true;
    if (!account) return;
    Promise.all([
      token(settings, p.descriptor.poolKey.token0, account),
      token(settings, p.descriptor.poolKey.token1, account),
    ])
      .then(([a, b]) => {
        if (active) {
          setTokens([a, b]);
        }
      })
      .catch((e) => {
        if (active) setStatus(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [account, settings, p.descriptor, setStatus]);
  function deadline() {
    return BigInt(Math.floor(Date.now() / 1000) + 1200);
  }
  function factor() {
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > 1000)
      throw new Error("Invalid slippage.");
    return BigInt(10000 - slippage);
  }
  async function withdraw(feesOnly: boolean) {
    if (!Number.isInteger(portion) || portion < 1 || portion > 100)
      throw new Error("Withdrawal percentage must be 1–100.");
    const liquidity = feesOnly
      ? 0n
      : (p.amounts.liquidity * BigInt(portion)) / 100n;
    const fraction = feesOnly ? 0n : BigInt(portion);
    const min0 =
      (((p.amounts.principal0 * fraction) / 100n + p.amounts.fees0) *
        factor()) /
      10000n;
    const min1 =
      (((p.amounts.principal1 * fraction) / 100n + p.amounts.fees1) *
        factor()) /
      10000n;
    await send({
      to: settings.manager,
      data: managerData("multicall", [
        [
          managerData("withdraw", [
            p.id,
            liquidity,
            getAddress(recipient),
            min0,
            min1,
            deadline(),
          ]),
        ],
      ]),
    });
  }
  async function add() {
    if (!tokens) throw new Error("Token metadata unavailable.");
    if (!deposit.result)
      throw new Error("Wait for the matching deposit amount.");
    const { max0, max1, liquidity } = deposit.result;
    const transaction = {
      to: settings.manager,
      data: managerData("addLiquidity", [
        p.id,
        {
          maxAmount0: max0,
          maxAmount1: max1,
          minLiquidity: (liquidity * factor()) / 10000n,
          deadline: deadline(),
        },
      ]),
      value: p.descriptor.poolKey.token0 === zeroAddress ? max0 : 0n,
    };
    await send(
      batchSupported
        ? depositCalls(tokens, [max0, max1], settings.manager, transaction)
        : transaction,
    );
  }
  return {
    tokens,
    batchSupported,
    recipient,
    setRecipient,
    portion,
    setPortion,
    slippage,
    setSlippage,
    deposit,
    withdraw,
    add,
  };
}
