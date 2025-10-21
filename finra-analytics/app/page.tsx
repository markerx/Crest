"use client";

import { useState } from "react";
import Link from "next/link";
import { SimpleScreener } from "@/components/screener/SimpleScreener";

export default function Home() {
  const [symbol, setSymbol] = useState("");

  const popularSymbols = ["NVDA", "AAPL", "TSLA", "GME", "AMC", "PLTR"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">FINRA Analytics</h1>
          <p className="text-gray-600 mt-2">
            Real-time short interest analysis powered by FINRA equity data
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Analyze a Stock
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter ticker symbol (e.g., NVDA)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyPress={(e) => {
                if (e.key === "Enter" && symbol) {
                  window.location.href = `/ticker/${symbol}`;
                }
              }}
            />
            <Link
              href={symbol ? `/ticker/${symbol}` : "#"}
              className={`px-6 py-3 rounded-lg font-semibold ${
                symbol
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              onClick={(e) => {
                if (!symbol) e.preventDefault();
              }}
            >
              Analyze
            </Link>
          </div>

          {/* Popular Symbols */}
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Popular symbols:</p>
            <div className="flex flex-wrap gap-2">
              {popularSymbols.map((sym) => (
                <Link
                  key={sym}
                  href={`/ticker/${sym}`}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
                >
                  {sym}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <FeatureCard
            title="Short Interest"
            description="Semi-monthly short position data with Days-to-Cover and trend analysis"
            icon="📊"
          />
          <FeatureCard
            title="Reg SHO Daily Flow"
            description="Daily short sale volume, ratios, and statistical anomaly detection"
            icon="📈"
          />
          <FeatureCard
            title="Threshold List"
            description="Track securities with persistent delivery failures under Reg SHO"
            icon="⚠️"
          />
        </div>

        {/* Screener */}
        <SimpleScreener />

        {/* Data Attribution */}
        <div className="mt-8 bg-gray-100 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Data Sources</h3>
          <p className="text-sm text-gray-700 mb-3">
            All data sourced from{" "}
            <a
              href="https://developer.finra.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              FINRA API Developer Center
            </a>
            :
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Consolidated Short Interest (semi-monthly settlement data)</li>
            <li>Reg SHO Daily Short Sale Volume</li>
            <li>Threshold Securities List</li>
            <li>OTC Transparency Weekly/Monthly Aggregates</li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            <strong>Disclaimer:</strong> This platform is for informational and
            research purposes only. Not financial advice. Data is cached and may
            have delays.
          </p>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
