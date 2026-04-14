/**
 * Statistical utility functions for PeakProtocol charts (WRK-029).
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
}

/**
 * Compute simple linear regression (least-squares) over a set of (x, y) points.
 *
 * @param points Array of { x, y } pairs. Minimum 2 points required.
 * @returns slope and intercept such that ŷ = slope * x + intercept
 */
export function linearRegression(
  points: { x: number; y: number }[],
): RegressionResult {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calculate trend-line y-values given parallel arrays of unix-second timestamps
 * and weight values. Timestamps are converted to day indices internally.
 *
 * Null/undefined entries in weights are skipped — the regression is computed
 * only on valid data points, but the returned array has values for every index
 * (or null where the input was null).
 *
 * @param timestamps Unix-second timestamps (one per data point)
 * @param weights    Weight values (null = missing)
 * @returns Array of trend y-values aligned with the input arrays (null where input was null)
 */
export function calculateTrendLine(
  timestamps: number[],
  weights: (number | null)[],
): (number | null)[] {
  const SEC_PER_DAY = 86400;
  const baseTs = timestamps[0] ?? 0;

  // Collect valid points
  const validPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const w = weights[i];
    if (w != null) {
      validPoints.push({ x: (timestamps[i] - baseTs) / SEC_PER_DAY, y: w });
    }
  }

  if (validPoints.length < 2) {
    // Not enough data for a trend — return nulls
    return weights.map(() => null);
  }

  const { slope, intercept } = linearRegression(validPoints);

  return timestamps.map((ts, i) => {
    if (weights[i] == null) return null;
    const dayIndex = (ts - baseTs) / SEC_PER_DAY;
    return slope * dayIndex + intercept;
  });
}
