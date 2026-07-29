// The save stores totalMoneyEarned as a 32-bit integer, so it wraps around after
// 2,147,483,647 and shows up negative (or, after earning another ~2.1B, positive again).
// Each time the limit is passed the stored value is one full 32-bit range (2^32)
// below the real total, so the real total is stored + overflowCount * 2^32.
const INT32_RANGE = 4_294_967_296;

export function correctTotalMoneyEarned(stored: number, overflowCount: number): number {
  // A negative stored value proves the limit was passed at least once,
  // even when the user has not configured the overflow count yet.
  const wraps = stored < 0 ? Math.max(1, overflowCount) : overflowCount;
  return stored + wraps * INT32_RANGE;
}
