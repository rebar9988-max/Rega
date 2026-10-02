/** Pure rating helpers (unit-tested). */
export const MAX_COMMENT = 1000;

export const isStarRating = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 5;

/** Average (one decimal, as stored in Business.ratingAvg) and count of approved ratings. */
export function aggregate(ratings: number[]): { avg: number; count: number } {
  const valid = ratings.filter(isStarRating);
  if (valid.length === 0) return { avg: 0, count: 0 };
  return { avg: Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10, count: valid.length };
}
