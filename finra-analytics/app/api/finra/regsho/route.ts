import { NextRequest, NextResponse } from "next/server";
import { QueryParamsSchema } from "@/lib/types/finra";
import { fetchRegShoDaily } from "@/lib/finra/client";
import { normalizeRegSho } from "@/lib/finra/normalize";
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from "@/lib/cache/redis";

/**
 * GET /api/finra/regsho
 * Fetch Reg SHO Daily Short Sale Volume data with caching
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
    const cacheKey = CacheKeys.regSho(params.symbol, params.from, params.to);
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
    const response = await fetchRegShoDaily({
      symbol: params.symbol,
      from: params.from,
      to: params.to,
    });

    // Normalize data
    const normalized = normalizeRegSho(response);

    // Build result
    const result = {
      symbol: params.symbol,
      from: params.from,
      to: params.to,
      count: normalized.length,
      data: normalized,
      metadata: {
        pulledAt: new Date().toISOString(),
        source: "FINRA Reg SHO Daily Short Sale Volume",
        dataset: "regShoDaily",
      },
    };

    // Cache the result
    await cacheSet(cacheKey, result, CacheTTL.regSho);

    return NextResponse.json(result, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CacheTTL.regSho}`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Reg SHO API error:", error);

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
        error: "Failed to fetch Reg SHO data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
