import { useQuery } from "@tanstack/react-query";

/**
 * React Query hooks for FINRA API endpoints
 */

interface QueryParams {
  symbol: string;
  from?: string;
  to?: string;
}

/**
 * Fetch Reg SHO daily short sale volume data
 */
export function useRegShoData({ symbol, from, to }: QueryParams) {
  return useQuery({
    queryKey: ["regsho", symbol, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ symbol });
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/finra/regsho?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch Reg SHO data");
      }

      return response.json();
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch consolidated short interest data
 */
export function useShortInterestData({ symbol, from, to }: QueryParams) {
  return useQuery({
    queryKey: ["shortinterest", symbol, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ symbol });
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/finra/shortinterest?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch Short Interest data");
      }

      return response.json();
    },
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000, // 1 hour (semi-monthly data)
  });
}

/**
 * Fetch threshold list data
 */
export function useThresholdData({ symbol, from, to }: QueryParams) {
  return useQuery({
    queryKey: ["threshold", symbol, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (symbol) params.set("symbol", symbol);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/finra/threshold?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch Threshold data");
      }

      return response.json();
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Combined hook for all ticker data
 */
export function useTickerData(symbol: string, dateRange?: { from?: string; to?: string }) {
  const regSho = useRegShoData({
    symbol,
    from: dateRange?.from,
    to: dateRange?.to,
  });

  const shortInterest = useShortInterestData({
    symbol,
    from: dateRange?.from,
    to: dateRange?.to,
  });

  const threshold = useThresholdData({
    symbol,
    from: dateRange?.from,
    to: dateRange?.to,
  });

  return {
    regSho,
    shortInterest,
    threshold,
    isLoading: regSho.isLoading || shortInterest.isLoading || threshold.isLoading,
    isError: regSho.isError || shortInterest.isError || threshold.isError,
    error: regSho.error || shortInterest.error || threshold.error,
  };
}
