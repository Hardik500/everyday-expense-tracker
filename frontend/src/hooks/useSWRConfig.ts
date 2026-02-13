import { fetchWithAuth } from "../utils/api";

// Custom fetcher for SWR that uses our auth system
export const swrFetcher = async (url: string) => {
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }
  return response.json();
};

// SWR Configuration for the app
export const swrConfig = {
  refreshInterval: 0, // Don't auto-refresh
  revalidateOnFocus: false, // Don't revalidate when tab comes into focus
  revalidateOnReconnect: true, // Revalidate when network reconnects
  dedupingInterval: 2000, // Dedupe requests within 2 seconds
  suspense: false, // Don't use suspense mode
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  // Keep cached data for 5 minutes even if component unmounts
  keepPreviousData: true,
};

// Cache key helpers
export const cacheKeys = {
  dashboard: (apiBase: string, selectedMonth: string) =>
    `${apiBase}/reports/summary?month=${selectedMonth || "all"}`,
  transactions: (apiBase: string, params?: string) =>
    `${apiBase}/transactions${params || ""}`,
  categories: (apiBase: string) => `${apiBase}/categories`,
  accounts: (apiBase: string) => `${apiBase}/accounts`,
  cards: (apiBase: string) => `${apiBase}/cards`,
  rules: (apiBase: string) => `${apiBase}/rules`,
  recurring: (apiBase: string) => `${apiBase}/recurring`,
  analytics: (apiBase: string, start?: string, end?: string) =>
    `${apiBase}/reports/summary${start ? `?start=${start}&end=${end}` : ""}`,
  timeseries: (apiBase: string, params?: string) =>
    `${apiBase}/reports/timeseries${params || ""}`,
  reviewCount: (apiBase: string) => `${apiBase}/transactions?uncertain=true`,
};
