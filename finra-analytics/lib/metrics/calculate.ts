import { NormalizedRegSho, NormalizedShortInterest, DailyMetrics } from "../types/finra";

/**
 * Derived metrics calculation
 * Computes Days-to-Cover, % Float Short, Z-scores, rolling averages, trends
 */

/**
 * Calculate rolling average for a time series
 */
export function rollingAverage(
  values: number[],
  windowSize: number
): (number | null)[] {
  if (values.length < windowSize) {
    return values.map(() => null);
  }

  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
    } else {
      const window = values.slice(i - windowSize + 1, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
      result.push(avg);
    }
  }

  return result;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate Z-score (standardized value)
 * Z = (X - μ) / σ
 */
export function calculateZScore(
  value: number,
  mean: number,
  stdDev: number
): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Calculate Z-scores for a time series using rolling baseline
 */
export function calculateRollingZScores(
  values: number[],
  baselineWindow = 60
): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < baselineWindow) {
      result.push(null);
    } else {
      const baseline = values.slice(i - baselineWindow, i);
      const mean = baseline.reduce((sum, val) => sum + val, 0) / baseline.length;
      const stdDev = standardDeviation(baseline);
      const zScore = calculateZScore(values[i], mean, stdDev);
      result.push(zScore);
    }
  }

  return result;
}

/**
 * Calculate Days-to-Cover
 * DTC = Short Interest / Average Daily Volume
 */
export function calculateDaysToCover(
  sharesShort: number,
  avgDailyVolume: number | null
): number | null {
  if (!avgDailyVolume || avgDailyVolume === 0) return null;
  return sharesShort / avgDailyVolume;
}

/**
 * Calculate % of Float Short
 * Requires external float data
 */
export function calculatePercentFloatShort(
  sharesShort: number,
  floatShares: number | null
): number | null {
  if (!floatShares || floatShares === 0) return null;
  return (sharesShort / floatShares) * 100;
}

/**
 * Calculate linear regression slope (trend)
 * Returns slope coefficient (rise/run)
 */
export function calculateTrend(
  values: number[],
  points: number
): number | null {
  if (values.length < points) return null;

  const recentValues = values.slice(-points);
  const n = recentValues.length;

  // Simple linear regression: y = mx + b
  // slope m = (n * Σxy - Σx * Σy) / (n * Σx² - (Σx)²)
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  recentValues.forEach((y, i) => {
    const x = i + 1;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  return slope;
}

/**
 * Compute daily metrics from Reg SHO data
 */
export function computeDailyMetrics(
  regShoData: NormalizedRegSho[],
  thresholdStatus: Map<string, boolean>,
  thresholdStreaks: Map<string, number>
): DailyMetrics[] {
  // Sort by date
  const sorted = [...regShoData].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  // Extract short sale volumes for rolling calculations
  const shortSaleVolumes = sorted.map((r) => r.shortSaleShares);

  // Calculate rolling averages
  const rolling5d = rollingAverage(shortSaleVolumes, 5);
  const rolling10d = rollingAverage(shortSaleVolumes, 10);
  const rolling20d = rollingAverage(shortSaleVolumes, 20);

  // Calculate Z-scores (60-day baseline)
  const zScores = calculateRollingZScores(shortSaleVolumes, 60);

  return sorted.map((record, index) => ({
    symbol: record.symbol,
    tradeDate: record.tradeDate,
    shortSaleRatio: record.shortSaleRatio,
    shortSaleZScore: zScores[index],
    rolling5d: rolling5d[index],
    rolling10d: rolling10d[index],
    rolling20d: rolling20d[index],
    onThreshold: thresholdStatus.get(record.tradeDate) || false,
    thresholdStreakDays: thresholdStreaks.get(record.tradeDate) || 0,
  }));
}

/**
 * Detect "what changed today" signals
 */
export interface ChangeSignal {
  type: "threshold_entry" | "threshold_exit" | "short_spike" | "dtc_cross" | "si_jump";
  message: string;
  severity: "info" | "warning" | "alert";
}

export function detectChanges(
  todayMetrics: DailyMetrics,
  yesterdayMetrics: DailyMetrics | null,
  todaySI: NormalizedShortInterest | null,
  prevSI: NormalizedShortInterest | null
): ChangeSignal[] {
  const signals: ChangeSignal[] = [];

  // Threshold entry/exit
  if (yesterdayMetrics) {
    if (todayMetrics.onThreshold && !yesterdayMetrics.onThreshold) {
      signals.push({
        type: "threshold_entry",
        message: "Added to Reg SHO Threshold List",
        severity: "alert",
      });
    } else if (!todayMetrics.onThreshold && yesterdayMetrics.onThreshold) {
      signals.push({
        type: "threshold_exit",
        message: "Removed from Reg SHO Threshold List",
        severity: "info",
      });
    }
  }

  // Short sale spike (>3σ)
  if (todayMetrics.shortSaleZScore && todayMetrics.shortSaleZScore > 3) {
    signals.push({
      type: "short_spike",
      message: `Short sale volume spike: ${todayMetrics.shortSaleZScore.toFixed(1)}σ above baseline`,
      severity: "warning",
    });
  }

  // Short Interest jump
  if (todaySI && prevSI) {
    const changePct = todaySI.changePct || 0;
    if (Math.abs(changePct) > 20) {
      signals.push({
        type: "si_jump",
        message: `Short Interest ${changePct > 0 ? "increased" : "decreased"} ${Math.abs(changePct).toFixed(1)}%`,
        severity: changePct > 0 ? "warning" : "info",
      });
    }
  }

  // Days-to-Cover crossing thresholds
  if (todaySI && prevSI) {
    const todayDTC = todaySI.daysToCover || 0;
    const prevDTC = prevSI.daysToCover || 0;

    if (prevDTC < 3 && todayDTC >= 3) {
      signals.push({
        type: "dtc_cross",
        message: "Days-to-Cover crossed above 3",
        severity: "warning",
      });
    } else if (prevDTC < 5 && todayDTC >= 5) {
      signals.push({
        type: "dtc_cross",
        message: "Days-to-Cover crossed above 5",
        severity: "alert",
      });
    }
  }

  return signals;
}

/**
 * Calculate momentum score (composite indicator)
 * Range: -100 to +100, where positive = accumulation pressure
 */
export function calculateMomentumScore(metrics: DailyMetrics): number {
  let score = 0;

  // Z-score contribution (±40 points)
  if (metrics.shortSaleZScore !== null) {
    score += Math.max(-40, Math.min(40, metrics.shortSaleZScore * 10));
  }

  // Threshold status (+20 points)
  if (metrics.onThreshold) {
    score += 20;
  }

  // Threshold streak (up to +40 points)
  if (metrics.thresholdStreakDays > 0) {
    score += Math.min(40, metrics.thresholdStreakDays * 4);
  }

  return Math.round(Math.max(-100, Math.min(100, score)));
}
