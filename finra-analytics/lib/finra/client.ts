import {
  RegShoResponse,
  RegShoResponseSchema,
  ShortInterestResponse,
  ShortInterestResponseSchema,
  ThresholdResponse,
  ThresholdResponseSchema,
  OTCSummaryResponse,
  OTCSummaryResponseSchema,
} from "../types/finra";

/**
 * FINRA API Client with OAuth 2.0 Authentication
 * Implements token caching and retry logic with exponential backoff
 */

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get OAuth 2.0 access token from FINRA Identity Platform (FIP)
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 1 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.FINRA_CLIENT_ID;
  const clientSecret = process.env.FINRA_CLIENT_SECRET;
  const tokenUrl = process.env.FINRA_TOKEN_URL;

  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error(
      "FINRA credentials not configured. Set FINRA_CLIENT_ID, FINRA_CLIENT_SECRET, and FINRA_TOKEN_URL"
    );
  }

  // Basic Auth: base64(clientId:clientSecret)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `FINRA token request failed: ${response.status} ${errorText}`
      );
    }

    const data: OAuthTokenResponse = await response.json();

    // Cache token (30 min default, but use expires_in - 5 min buffer)
    const expiresIn = data.expires_in || 1800;
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error("Failed to obtain FINRA access token:", error);
    throw error;
  }
}

/**
 * Exponential backoff retry helper
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 4
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Return on success
      if (response.ok) {
        return response;
      }

      // Retry on server errors (5xx) or rate limit (429)
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}: ${await response.text()}`);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s
          console.warn(
            `FINRA API error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Build FINRA API URL with query parameters
 */
function buildFinraUrl(params: {
  group: string;
  dataset: string;
  filters: Record<string, string | undefined>;
}): string {
  const baseUrl = process.env.FINRA_API_BASE_URL || "https://api.finra.org";
  const url = new URL(
    `/data/group/${params.group}/name/${params.dataset}`,
    baseUrl
  );

  // Add query parameters
  Object.entries(params.filters).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Generic FINRA API fetch with authentication
 */
async function finraFetch<T>(
  group: string,
  dataset: string,
  filters: Record<string, string | undefined> = {}
): Promise<T> {
  const token = await getAccessToken();
  const url = buildFinraUrl({ group, dataset, filters });

  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `FINRA API request failed: ${response.status} ${errorText}`
    );
  }

  return response.json();
}

/**
 * Public API methods for each dataset
 */

export async function fetchRegShoDaily(params: {
  symbol: string;
  from?: string;
  to?: string;
}): Promise<RegShoResponse> {
  const data = await finraFetch<unknown>("otcMarket", "regShoDaily", {
    symbolCode: params.symbol,
    startDate: params.from,
    endDate: params.to,
  });

  // Validate response schema
  return RegShoResponseSchema.parse(data);
}

export async function fetchShortInterest(params: {
  symbol: string;
  from?: string;
  to?: string;
}): Promise<ShortInterestResponse> {
  const data = await finraFetch<unknown>("otcMarket", "consolidatedShortInterest", {
    symbolCode: params.symbol,
    startDate: params.from,
    endDate: params.to,
  });

  return ShortInterestResponseSchema.parse(data);
}

export async function fetchThresholdList(params: {
  symbol?: string;
  from?: string;
  to?: string;
}): Promise<ThresholdResponse> {
  const data = await finraFetch<unknown>("otcMarket", "thresholdList", {
    symbolCode: params.symbol,
    startDate: params.from,
    endDate: params.to,
  });

  return ThresholdResponseSchema.parse(data);
}

export async function fetchOTCSummary(params: {
  symbol: string;
  from?: string;
  to?: string;
}): Promise<OTCSummaryResponse> {
  const data = await finraFetch<unknown>("otcMarket", "weeklySummary", {
    symbolCode: params.symbol,
    weekStartDate: params.from,
  });

  return OTCSummaryResponseSchema.parse(data);
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch (error) {
    console.error("FINRA API health check failed:", error);
    return false;
  }
}
