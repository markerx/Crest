"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  shortSaleShares: number;
  shortSaleRatio?: number | null;
  totalVolume?: number | null;
  onThreshold?: boolean;
}

interface ShortSaleChartProps {
  data: DataPoint[];
  showVolume?: boolean;
  height?: number;
}

/**
 * Short Sale Volume Chart with optional threshold markers
 */
export function ShortSaleChart({
  data,
  showVolume = false,
  height = 300,
}: ShortSaleChartProps) {
  // Format data for display
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    shortSales: d.shortSaleShares,
    totalVolume: d.totalVolume || 0,
    ratio: d.shortSaleRatio ? (d.shortSaleRatio * 100).toFixed(1) : null,
    threshold: d.onThreshold ? d.shortSaleShares : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        <XAxis
          dataKey="date"
          className="text-xs"
          tick={{ fill: "#6b7280" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "#6b7280" }}
          tickFormatter={(value) => {
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
            return value.toFixed(0);
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
          }}
          formatter={(value: number, name: string) => {
            if (name === "ratio") return [`${value}%`, "Short Ratio"];
            return [value.toLocaleString(), name === "shortSales" ? "Short Sales" : "Total Volume"];
          }}
        />
        <Legend />
        <Bar dataKey="shortSales" fill="#ef4444" name="Short Sales" />
        {showVolume && <Bar dataKey="totalVolume" fill="#3b82f6" name="Total Volume" />}
        {/* Highlight threshold days */}
        <Bar dataKey="threshold" fill="#dc2626" name="On Threshold" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Short Interest Trend Chart (semi-monthly)
 */
interface SIDataPoint {
  settlementDate: string;
  sharesShort: number;
  changePct?: number | null;
  daysToCover?: number | null;
}

interface ShortInterestChartProps {
  data: SIDataPoint[];
  height?: number;
}

export function ShortInterestChart({
  data,
  height = 250,
}: ShortInterestChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.settlementDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    shares: d.sharesShort,
    dtc: d.daysToCover,
    change: d.changePct,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        <XAxis dataKey="date" className="text-xs" tick={{ fill: "#6b7280" }} />
        <YAxis
          yAxisId="left"
          className="text-xs"
          tick={{ fill: "#6b7280" }}
          tickFormatter={(value) => {
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
            return value.toFixed(0);
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          className="text-xs"
          tick={{ fill: "#6b7280" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="shares"
          stroke="#ef4444"
          strokeWidth={2}
          name="Shares Short"
          dot={{ r: 4 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="dtc"
          stroke="#f59e0b"
          strokeWidth={2}
          name="Days-to-Cover"
          dot={{ r: 4 }}
        />
        <ReferenceLine yAxisId="right" y={3} stroke="#9ca3af" strokeDasharray="3 3" />
        <ReferenceLine yAxisId="right" y={5} stroke="#9ca3af" strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
