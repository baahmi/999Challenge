import { describe, expect, it } from 'bun:test';
import { correctTotalMoneyEarned } from './money';

describe('correctTotalMoneyEarned', () => {
  it('leaves non-overflowed totals alone', () => {
    expect(correctTotalMoneyEarned(1_139_453_326, 0)).toBe(1_139_453_326);
  });

  it('adds one 32-bit range per configured overflow', () => {
    // 3 billion earned wraps to a negative stored value
    expect(correctTotalMoneyEarned(3_000_000_000 - 4_294_967_296, 1)).toBe(3_000_000_000);
    // 5 billion earned wraps all the way back to positive
    expect(correctTotalMoneyEarned(5_000_000_000 - 4_294_967_296, 1)).toBe(5_000_000_000);
    // 7.5 billion earned means the limit was passed twice
    expect(correctTotalMoneyEarned(7_500_000_000 - 2 * 4_294_967_296, 2)).toBe(7_500_000_000);
  });

  it('assumes one overflow for negative totals even when not configured', () => {
    expect(correctTotalMoneyEarned(-1_294_967_296, 0)).toBe(3_000_000_000);
  });
});
