import { expect, test } from "bun:test";
import { minimumLiquidity, withdrawalReview } from "../../src/positionReview";

const amounts = {
  liquidity: 101n,
  principal0: 1_000n,
  principal1: 2_000n,
  fees0: 17n,
  fees1: 29n,
};

test("withdrawal review scales principal by rounded liquidity and includes every fee", () => {
  expect(withdrawalReview(amounts, 50)).toEqual({
    liquidity: 50n,
    principal0: 495n,
    principal1: 990n,
    fees0: 17n,
    fees1: 29n,
    total0: 512n,
    total1: 1_019n,
    full: false,
  });
});

test("tiny partial withdrawal is rejected before calldata can be built", () => {
  expect(() => withdrawalReview({ ...amounts, liquidity: 1n }, 1)).toThrow(
    "rounds to zero",
  );
});

test("minimum liquidity stays positive at readiness and transaction boundaries", () => {
  expect(minimumLiquidity(1n, 0)).toBe(1n);
  expect(minimumLiquidity(1n, 1000)).toBe(0n);
  expect(() => withdrawalReview(amounts, 0)).toThrow("percentage");
});

test("full withdrawal is explicitly marked as closing the position", () => {
  expect(withdrawalReview(amounts, 100).full).toBe(true);
});
