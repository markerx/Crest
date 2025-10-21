"use client";

import { useState } from "react";

/**
 * Simple stock screener based on FINRA metrics
 * Future: Connect to backend screener API endpoint
 */

interface ScreenerFilters {
  daysToCoverMin?: number;
  daysToCoverMax?: number;
  onThresholdOnly: boolean;
}

export function SimpleScreener() {
  const [filters, setFilters] = useState<ScreenerFilters>({
    onThresholdOnly: false,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Stock Screener</h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Days-to-Cover
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g., 3.0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.daysToCoverMin || ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                daysToCoverMin: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Days-to-Cover
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g., 10.0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.daysToCoverMax || ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                daysToCoverMax: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={filters.onThresholdOnly}
              onChange={(e) =>
                setFilters({ ...filters, onThresholdOnly: e.target.checked })
              }
            />
            <span className="text-sm font-medium text-gray-700">
              On Threshold List Only
            </span>
          </label>
        </div>
      </div>

      {/* Results placeholder */}
      <div className="border-t border-gray-200 pt-6">
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">Screener Coming Soon</p>
          <p className="text-sm">
            This will filter stocks based on FINRA metrics like Days-to-Cover, % Float
            Short, Threshold status, and short sale momentum.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Example Screens to Implement:
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>High short pressure: DTC &gt; 5 + on threshold &gt; 5 days</li>
          <li>Short accumulation: Rising short sales, flat/down volume</li>
          <li>Cover risk: Short sales falling, price rising, high DTC</li>
          <li>Momentum spike: Short sale Z-score &gt; 3σ</li>
        </ul>
      </div>
    </div>
  );
}
