import useSWR from "swr";
import { swrFetcher } from "./useSWRConfig";
import type {
  Category,
  Account,
  Card,
  Rule,
  RecurringExpense,
  DashboardSummary,
  Transaction,
  CategoryDetail
} from "../types";

/**
 * Options for useApiData hook
 */
export interface UseApiDataOptions {
  /** Whether to revalidate on focus */
  revalidateOnFocus?: boolean;
  /** Whether to keep previous data while fetching new data */
  keepPreviousData?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Error retry count */
  errorRetryCount?: number;
}

/**
 * Generic hook for fetching data from API
 */
export function useApiData<T>(url: string | null, options?: UseApiDataOptions) {
  return useSWR<T>(url, swrFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    ...options,
  });
}

/**
 * Hook for fetching transactions
 */
export function useTransactions(apiBase: string, params?: string) {
  return useApiData<Transaction[]>(`${apiBase}/transactions${params || ""}`);
}

/**
 * Hook for fetching categories
 */
export function useCategories(apiBase: string) {
  return useApiData<Category[]>(`${apiBase}/categories`);
}

/**
 * Hook for fetching accounts
 */
export function useAccounts(apiBase: string) {
  return useApiData<Account[]>(`${apiBase}/accounts`);
}

/**
 * Hook for fetching cards
 */
export function useCards(apiBase: string) {
  return useApiData<Card[]>(`${apiBase}/cards`);
}

/**
 * Hook for fetching rules
 */
export function useRules(apiBase: string) {
  return useApiData<Rule[]>(`${apiBase}/rules`);
}

/**
 * Hook for fetching recurring expenses
 */
export function useRecurring(apiBase: string) {
  return useApiData<RecurringExpense[]>(`${apiBase}/recurring`);
}

/**
 * Hook for fetching analytics data
 */
export function useAnalytics(apiBase: string, start?: string, end?: string) {
  const url = start || end
    ? `${apiBase}/reports/summary?start=${start}&end=${end}`
    : `${apiBase}/reports/summary`;
  return useApiData<DashboardSummary>(url);
}

/**
 * Hook for fetching timeseries data
 */
export function useTimeSeries(apiBase: string, params?: string) {
  return useApiData<{ date: string; amount: number }[]>(
    `${apiBase}/reports/timeseries${params || ""}`
  );
}

/**
 * Hook for fetching review count (uncertain transactions)
 */
export function useReviewCount(apiBase: string) {
  return useApiData<Transaction[]>(`${apiBase}/transactions?uncertain=true`);
}

/**
 * Hook for fetching dashboard summary
 */
export function useDashboardSummary(apiBase: string, selectedMonth?: string) {
  let url = `${apiBase}/reports/summary`;
  if (selectedMonth) {
    const [year, month] = selectedMonth.split("-");
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }
  return useApiData<DashboardSummary>(url);
}

/**
 * Hook for fetching category details
 */
export function useCategoryDetail(apiBase: string, categoryId: number | null, params?: string) {
  return useApiData<CategoryDetail>(
    categoryId ? `${apiBase}/reports/categories/${categoryId}${params || ""}` : null
  );
}
