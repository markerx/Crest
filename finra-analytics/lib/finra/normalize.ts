import {
  RegShoResponse,
  ShortInterestResponse,
  ThresholdResponse,
  NormalizedRegSho,
  NormalizedShortInterest,
  NormalizedThreshold,
} from "../types/finra";

/**
 * Data normalization utilities
 * Transform FINRA API responses into internal canonical data models
 */

/**
 * Normalize Reg SHO Daily Short Sale Volume data
 */
export function normalizeRegSho(response: RegShoResponse): NormalizedRegSho[] {
  return response.data.map((record) => {
    const shortSaleShares = record.shortSaleVolumeShares;
    const totalVolume = record.totalVolumeShares || null;
    const shortSaleRatio =
      totalVolume && totalVolume > 0 ? shortSaleShares / totalVolume : null;

    return {
      symbol: record.symbolCode,
      tradeDate: record.tradeReportDate,
      shortSaleShares,
      shortExemptShares: record.shortExemptVolumeShares || 0,
      totalVolume,
      facility: record.facilityCode || null,
      shortSaleRatio,
    };
  });
}

/**
 * Normalize Consolidated Short Interest data
 */
export function normalizeShortInterest(
  response: ShortInterestResponse
): NormalizedShortInterest[] {
  return response.data.map((record) => {
    const sharesShort = record.currentShortPositionQuantity;
    const previousSharesShort = record.previousShortPositionQuantity || null;
    const changeShares = record.changeInShortPosition || null;

    // Calculate % change if we have previous value
    let changePct: number | null = null;
    if (previousSharesShort && previousSharesShort > 0) {
      changePct = ((sharesShort - previousSharesShort) / previousSharesShort) * 100;
    }

    return {
      symbol: record.symbolCode,
      settlementDate: record.settlementDate,
      sharesShort,
      previousSharesShort,
      changeShares,
      changePct,
      avgDailyVolume: record.averageDailyVolumeQuantity || null,
      daysToCover: record.daysToCoverQuantity || null,
      market: record.marketClassCode || null,
    };
  });
}

/**
 * Normalize Threshold List data
 */
export function normalizeThreshold(
  response: ThresholdResponse
): NormalizedThreshold[] {
  return response.data.map((record) => ({
    symbol: record.symbolCode,
    tradeDate: record.tradeDate,
    onThreshold: true, // If it's in the response, it's on the threshold list
    market: record.marketCategoryCode,
    rule: record.ruleNumber || null,
  }));
}

/**
 * Compute SHA256 hash of payload for deduplication
 */
export async function hashPayload(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Use Web Crypto API (available in Node.js 15+)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Create audit metadata for raw storage
 */
export interface AuditMetadata {
  dataset: string;
  asOfDate: string;
  symbol: string;
  pulledAt: Date;
  hash: string;
}

export async function createAuditMetadata(
  dataset: string,
  symbol: string,
  asOfDate: string,
  payload: unknown
): Promise<AuditMetadata> {
  return {
    dataset,
    asOfDate,
    symbol,
    pulledAt: new Date(),
    hash: await hashPayload(payload),
  };
}

/**
 * Merge multiple facilities/markets for same symbol/date
 * Useful when aggregating TRF/ORF data
 */
export function aggregateRegShoBySymbolDate(
  records: NormalizedRegSho[]
): NormalizedRegSho[] {
  const grouped = new Map<string, NormalizedRegSho>();

  records.forEach((record) => {
    const key = `${record.symbol}:${record.tradeDate}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...record, facility: null }); // Clear facility when aggregating
    } else {
      // Sum up volumes across facilities
      existing.shortSaleShares += record.shortSaleShares;
      existing.shortExemptShares += record.shortExemptShares;
      if (existing.totalVolume && record.totalVolume) {
        existing.totalVolume += record.totalVolume;
      }

      // Recalculate ratio
      if (existing.totalVolume && existing.totalVolume > 0) {
        existing.shortSaleRatio = existing.shortSaleShares / existing.totalVolume;
      }
    }
  });

  return Array.from(grouped.values());
}

/**
 * Fill missing threshold dates with off-threshold records
 * Creates a complete time series with true/false for each date
 */
export function fillThresholdGaps(
  thresholdRecords: NormalizedThreshold[],
  dateRange: { from: string; to: string },
  symbol: string,
  market: string
): NormalizedThreshold[] {
  const onThresholdDates = new Set(
    thresholdRecords.map((r) => r.tradeDate)
  );

  const result: NormalizedThreshold[] = [];
  const start = new Date(dateRange.from);
  const end = new Date(dateRange.to);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];

    // Skip weekends (basic approximation, doesn't handle holidays)
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const existing = thresholdRecords.find((r) => r.tradeDate === dateStr);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        symbol,
        tradeDate: dateStr,
        onThreshold: false,
        market,
        rule: null,
      });
    }
  }

  return result;
}

/**
 * Calculate threshold streak (consecutive days on threshold)
 */
export function calculateThresholdStreak(
  records: NormalizedThreshold[],
  asOfDate: string
): number {
  // Sort by date descending
  const sorted = [...records].sort(
    (a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime()
  );

  let streak = 0;
  for (const record of sorted) {
    if (record.tradeDate > asOfDate) continue;
    if (!record.onThreshold) break;
    streak++;
  }

  return streak;
}
