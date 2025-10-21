import { z } from "zod";

/**
 * FINRA API Response Schemas
 * Based on FINRA API Developer Center documentation
 */

// Common date formats used by FINRA
export const FinraDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Dataset identifiers
export const DatasetType = z.enum([
  "regShoDaily",
  "consolidatedShortInterest",
  "thresholdList",
  "otcSummary",
  "weeklyAggregate",
  "monthlyAggregate",
]);

export type DatasetType = z.infer<typeof DatasetType>;

/**
 * Reg SHO Daily Short Sale Volume
 * Source: FINRA Equity Short Sale Datasets
 */
export const RegShoRecordSchema = z.object({
  symbolCode: z.string(),
  marketCode: z.string().optional(),
  tradeReportDate: FinraDateSchema,
  shortSaleVolumeShares: z.number().int(),
  shortExemptVolumeShares: z.number().int().optional(),
  totalVolumeShares: z.number().int().optional(),
  facilityCode: z.string().optional(), // TRF/ORF identifier
});

export const RegShoResponseSchema = z.object({
  data: z.array(RegShoRecordSchema),
  totalRecords: z.number().int().optional(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type RegShoRecord = z.infer<typeof RegShoRecordSchema>;
export type RegShoResponse = z.infer<typeof RegShoResponseSchema>;

/**
 * Consolidated Short Interest (semi-monthly)
 * Source: FINRA Equity Short Interest
 */
export const ShortInterestRecordSchema = z.object({
  symbolCode: z.string(),
  settlementDate: FinraDateSchema,
  currentShortPositionQuantity: z.number().int(),
  previousShortPositionQuantity: z.number().int().optional(),
  changeInShortPosition: z.number().int().optional(),
  averageDailyVolumeQuantity: z.number().int().optional(),
  daysToCoverQuantity: z.number().optional(),
  marketClassCode: z.string().optional(), // e.g., 'O' for OTC
});

export const ShortInterestResponseSchema = z.object({
  data: z.array(ShortInterestRecordSchema),
  totalRecords: z.number().int().optional(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ShortInterestRecord = z.infer<typeof ShortInterestRecordSchema>;
export type ShortInterestResponse = z.infer<typeof ShortInterestResponseSchema>;

/**
 * Reg SHO Threshold List
 * Source: FINRA Threshold Securities List
 */
export const ThresholdRecordSchema = z.object({
  symbolCode: z.string(),
  securityName: z.string().optional(),
  marketCategoryCode: z.string(), // 'NYSE' | 'NASDAQ' | 'NYSE American'
  tradeDate: FinraDateSchema,
  ruleNumber: z.string().optional(), // e.g., 'Rule 203(c)(6)'
});

export const ThresholdResponseSchema = z.object({
  data: z.array(ThresholdRecordSchema),
  totalRecords: z.number().int().optional(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ThresholdRecord = z.infer<typeof ThresholdRecordSchema>;
export type ThresholdResponse = z.infer<typeof ThresholdResponseSchema>;

/**
 * OTC Summary Data
 * Source: FINRA OTC Transparency Weekly/Monthly Aggregates
 */
export const OTCSummaryRecordSchema = z.object({
  symbolCode: z.string(),
  tierIdentifier: z.string().optional(),
  weekStartDate: FinraDateSchema.optional(),
  monthStartDate: FinraDateSchema.optional(),
  totalWeeklyShareQuantity: z.number().int().optional(),
  totalWeeklyTradeCount: z.number().int().optional(),
  blockTradeCount: z.number().int().optional(),
  blockShareQuantity: z.number().int().optional(),
});

export const OTCSummaryResponseSchema = z.object({
  data: z.array(OTCSummaryRecordSchema),
  totalRecords: z.number().int().optional(),
});

export type OTCSummaryRecord = z.infer<typeof OTCSummaryRecordSchema>;
export type OTCSummaryResponse = z.infer<typeof OTCSummaryResponseSchema>;

/**
 * Normalized internal data models
 */
export interface NormalizedRegSho {
  symbol: string;
  tradeDate: string;
  shortSaleShares: number;
  shortExemptShares: number;
  totalVolume: number | null;
  facility: string | null;
  shortSaleRatio: number | null; // calculated: shortSaleShares / totalVolume
}

export interface NormalizedShortInterest {
  symbol: string;
  settlementDate: string;
  sharesShort: number;
  previousSharesShort: number | null;
  changeShares: number | null;
  changePct: number | null;
  avgDailyVolume: number | null;
  daysToCover: number | null;
  market: string | null;
}

export interface NormalizedThreshold {
  symbol: string;
  tradeDate: string;
  onThreshold: boolean;
  market: string;
  rule: string | null;
}

/**
 * Derived metrics
 */
export interface DailyMetrics {
  symbol: string;
  tradeDate: string;
  shortSaleRatio: number | null;
  shortSaleZScore: number | null;
  rolling5d: number | null;
  rolling10d: number | null;
  rolling20d: number | null;
  onThreshold: boolean;
  thresholdStreakDays: number;
}

export interface SemiMonthlyMetrics {
  symbol: string;
  settlementDate: string;
  sharesShort: number;
  pctFloatShort: number | null; // requires external float data
  daysToCover: number | null;
  trend3p: number | null; // 3-period slope
  siChangePct: number | null;
}

export interface TickerOverview {
  symbol: string;
  companyName: string | null;
  exchange: string | null;
  sector: string | null;
  latestMetrics: DailyMetrics;
  latestSI: SemiMonthlyMetrics | null;
  recentActivity: {
    date: string;
    shortSaleShares: number;
    shortSaleRatio: number | null;
    onThreshold: boolean;
  }[];
}

/**
 * API Query Parameters
 */
export const QueryParamsSchema = z.object({
  symbol: z.string().min(1).max(10),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
  offset: z.number().int().min(0).optional(),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

/**
 * Screener filters
 */
export const ScreenerFiltersSchema = z.object({
  daysToCoverMin: z.number().optional(),
  daysToCoverMax: z.number().optional(),
  pctFloatShortMin: z.number().optional(),
  pctFloatShortMax: z.number().optional(),
  thresholdStreakMin: z.number().int().optional(),
  shortSaleZScoreMin: z.number().optional(),
  onThresholdOnly: z.boolean().optional(),
  sectors: z.array(z.string()).optional(),
  exchanges: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ScreenerFilters = z.infer<typeof ScreenerFiltersSchema>;
