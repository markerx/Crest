import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchThresholdList } from "@/lib/finra/client";
import { normalizeThreshold } from "@/lib/finra/normalize";
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from "@/lib/cache/redis";

const ThresholdQuerySchema = z.object({
  symbol: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * GET /api/finra/threshold
 * Fetch Reg SHO Threshold List with caching
 *
 * Query params:
 *   - symbol: Stock ticker (optional - omit to get full list)
 *   - from: Start date YYYY-MM-DD (optional)
 *   - to: End date YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const params = ThresholdQuerySchema.parse({
      symbol: searchParams.get("symbol") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    // Check cache first
    const cacheKey = CacheKeys.threshold(params.symbol || "all", params.from, params.to);
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch from FINRA API
    const response = await fetchThresholdList({
      symbol: params.symbol,
      from: params.from,
      to: params.to,
    });

    // Normalize data
    const normalized = normalizeThreshold(response);

    // Build result
    const result = {
      symbol: params.symbol || null,
      from: params.from,
      to: params.to,
      count: normalized.length,
      data: normalized,
      metadata: {
        pulledAt: new Date().toISOString(),
        source: "FINRA Reg SHO Threshold Securities List",
        dataset: "thresholdList",
        note: "Securities with significant delivery failures per Regulation SHO",
      },
    };

    // Cache the result
    await cacheSet(cacheKey, result, CacheTTL.threshold);

    return NextResponse.json(result, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CacheTTL.threshold}`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Threshold List API error:", error);

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
        error: "Failed to fetch Threshold List data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
