"use client";

import { useTickerData } from "@/lib/hooks/useFinraData";
import { ShortSaleChart, ShortInterestChart } from "../charts/ShortSaleChart";

interface TickerOverviewProps {
  symbol: string;
}

/**
 * Ticker Overview Panel
 * Displays latest metrics, charts, and "what changed" signals
 */
export function TickerOverview({ symbol }: TickerOverviewProps) {
  const { regSho, shortInterest, threshold, isLoading, isError, error } =
    useTickerData(symbol);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {symbol} data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error loading data</h3>
        <p className="text-red-600">
          {error instanceof Error ? error.message : "Unknown error occurred"}
        </p>
      </div>
    );
  }

  const regShoData = regSho.data?.data || [];
  const siData = shortInterest.data?.data || [];
  const thresholdData = threshold.data?.data || [];

  // Latest metrics
  const latestRegSho = regShoData[regShoData.length - 1];
  const latestSI = siData[siData.length - 1];
  const isOnThreshold = thresholdData.some((t: any) => t.onThreshold);

  return (
    <div className="space-y-6">
      {/* Header with symbol and status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{symbol}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Data from FINRA Equity APIs
            </p>
          </div>
          {isOnThreshold && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
              On Threshold List
            </div>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {latestSI && (
            <>
              <MetricCard
                label="Shares Short"
                value={formatNumber(latestSI.sharesShort)}
                change={latestSI.changePct}
                subtitle={`As of ${formatDate(latestSI.settlementDate)}`}
              />
              <MetricCard
                label="Days-to-Cover"
                value={latestSI.daysToCover?.toFixed(2) || "N/A"}
                alert={latestSI.daysToCover && latestSI.daysToCover > 5}
                subtitle="DTC"
              />
            </>
          )}
          {latestRegSho && (
            <>
              <MetricCard
                label="Short Sale Ratio"
                value={
                  latestRegSho.shortSaleRatio
                    ? `${(latestRegSho.shortSaleRatio * 100).toFixed(1)}%`
                    : "N/A"
                }
                subtitle={`${formatDate(latestRegSho.tradeDate)}`}
              />
              <MetricCard
                label="Short Sales"
                value={formatNumber(latestRegSho.shortSaleShares)}
                subtitle="Latest day"
              />
            </>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Short Interest Trend */}
        {siData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Short Interest Trend
            </h2>
            <ShortInterestChart data={siData} />
            <p className="text-xs text-gray-500 mt-2">
              Semi-monthly settlement dates. Source: FINRA
            </p>
          </div>
        )}

        {/* Short Sale Volume */}
        {regShoData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Short Sale Volume
            </h2>
            <ShortSaleChart
              data={regShoData.map((d: any) => ({
                date: d.tradeDate,
                shortSaleShares: d.shortSaleShares,
                shortSaleRatio: d.shortSaleRatio,
                totalVolume: d.totalVolume,
                onThreshold: thresholdData.some(
                  (t: any) => t.tradeDate === d.tradeDate && t.onThreshold
                ),
              }))}
              showVolume={false}
            />
            <p className="text-xs text-gray-500 mt-2">
              Red bars indicate Threshold List days. Source: FINRA Reg SHO
            </p>
          </div>
        )}
      </div>

      {/* Data Attribution */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-600">
          <strong>Data Sources:</strong> FINRA Consolidated Short Interest
          (semi-monthly), FINRA Reg SHO Daily Short Sale Volume, FINRA Threshold
          Securities List. Data is cached for performance. Not financial advice.
        </p>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number | null;
  alert?: boolean;
  subtitle?: string;
}

function MetricCard({ label, value, change, alert, subtitle }: MetricCardProps) {
  return (
    <div className={`p-4 rounded-lg ${alert ? "bg-red-50" : "bg-gray-50"}`}>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-red-700" : "text-gray-900"}`}>
        {value}
      </p>
      {change !== undefined && change !== null && (
        <p
          className={`text-sm font-semibold ${
            change > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          {change > 0 ? "+" : ""}
          {change.toFixed(2)}%
        </p>
      )}
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

/**
 * Utility functions
 */
function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
