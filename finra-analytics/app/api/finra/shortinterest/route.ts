import { NextRequest, NextResponse } from "next/server";
import { QueryParamsSchema } from "@/lib/types/finra";
import { fetchShortInterest } from "@/lib/finra/client";
import { normalizeShortInterest } from "@/lib/finra/normalize";
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from "@/lib/cache/redis";

/**
 * GET /api/finra/shortinterest
 * Fetch Consolidated Short Interest data (semi-monthly) with caching
 *
 * Query params:
 *   - symbol: Stock ticker (required)
 *   - from: Start date YYYY-MM-DD (optional)
 *   - to: End date YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const params = QueryParamsSchema.parse({
      symbol: searchParams.get("symbol"),
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    // Check cache first
    const cacheKey = CacheKeys.shortInterest(params.symbol, params.from, params.to);
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch from FINRA API
    const response = await fetchShortInterest({
      symbol: params.symbol,
      from: params.from,
      to: params.to,
    });

    // Normalize data
    const normalized = normalizeShortInterest(response);

    // Build result
    const result = {
      symbol: params.symbol,
      from: params.from,
      to: params.to,
      count: normalized.length,
      data: normalized,
      metadata: {
        pulledAt: new Date().toISOString(),
        source: "FINRA Consolidated Short Interest",
        dataset: "consolidatedShortInterest",
        note: "Semi-monthly settlement dates (mid-month and month-end)",
      },
    };

    // Cache the result (longer TTL since semi-monthly data changes infrequently)
    await cacheSet(cacheKey, result, CacheTTL.shortInterest);

    return NextResponse.json(result, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CacheTTL.shortInterest}`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Short Interest API error:", error);

    if (error instanceof Error && error.message.includes("FINRA credentials")) {
      return NextResponse.json(
        {
          error: "FINRA API not configured",
          message: "Server configuration error. Contact administrator.",
        },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          message: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch Short Interest data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
