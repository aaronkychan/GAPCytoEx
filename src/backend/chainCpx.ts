export function assertNonNegativeChainDegree(k: number): void {
  if (!Number.isInteger(k) || k < 0) {
    throw new RangeError("Bardzell chain degrees must be non-negative integers.");
  }
}
