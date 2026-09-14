import { useBatchSupport } from "./useBatchSupport";
import { depositCalls } from "./walletCalls";
import { usePositionDeposit } from "./usePositionDeposit";
import { useState } from "react";
import { getAddress, zeroAddress, type Address } from "viem";
import { useSession } from "./session";
import { managerData } from "./contracts";
import { depositWithRefund } from "./depositTransaction";
import type { Position } from "./types";
import { usePositionTokens } from "./usePositionTokens";
import { minimumLiquidity, withdrawalReview } from "./positionReview";
/** Ownership is enforced by the contract; no RPC read gates a submission. */
export function usePositionActions(p: Position, holder?: Address) {
  const { settings, account, send } = useSession();
  const { tokens, readiness, refreshTokens } = usePositionTokens(p, holder);
  const batchSupported = useBatchSupport();
  const [recipient, setRecipient] = useState(account ?? "");
  const [portion, setPortion] = useState(100);
  const [slippage, setSlippage] = useState(50);
  const deposit = usePositionDeposit(p, tokens);
  async function withdraw() {
    if (!account) throw new Error("Connect a wallet first.");
    const review = withdrawalReview(p.amounts, portion);
    await send({
      to: settings.manager,
      data: managerData("multicall", [
        [
          managerData("withdraw", [
            p.id,
            review.liquidity,
            getAddress(recipient),
          ]),
        ],
      ]),
    });
  }
  async function claim() {
    if (!account) throw new Error("Connect a wallet first.");
    // Claims have independent intent: cancelled withdrawal settings never apply.
    await send({
      to: settings.manager,
      data: managerData("multicall", [
        [managerData("withdraw", [p.id, 0n, account])],
      ]),
    });
  }
  function addTransaction() {
    if (
      !tokens ||
      !readiness?.every((read) => read.balanceReady && read.allowanceReady)
    )
      throw new Error(
        "Token balances and allowances are still loading. Retry when ready.",
      );
    if (!deposit.result)
      throw new Error("Wait for the matching deposit amount.");
    const { max0, max1, liquidity } = deposit.result;
    return depositWithRefund(
      settings,
      managerData("addLiquidity", [
        p.id,
        max0,
        max1,
        minimumLiquidity(liquidity, slippage),
      ]),
      p.descriptor.poolKey.token0 === zeroAddress ? max0 : 0n,
    );
  }
  async function add() {
    if (!account) throw new Error("Connect a wallet first.");
    const transaction = addTransaction();
    const { max0, max1, liquidity } = deposit.result!;
    if (minimumLiquidity(liquidity, slippage) <= 0n)
      throw new Error("Slippage would reduce minimum liquidity to zero.");
    await send(
      batchSupported
        ? depositCalls(tokens!, [max0, max1], settings.manager, transaction)
        : transaction,
    );
  }
  function gasCalls() {
    try {
      const transaction = addTransaction();
      const { max0, max1 } = deposit.result!;
      return depositCalls(tokens!, [max0, max1], settings.manager, transaction);
    } catch {
      return undefined;
    }
  }
  return {
    tokens,
    readiness,
    refreshTokens,
    batchSupported,
    recipient,
    setRecipient,
    portion,
    setPortion,
    slippage,
    setSlippage,
    deposit,
    withdraw,
    claim,
    add,
    nativeCalls: gasCalls(),
  };
}
