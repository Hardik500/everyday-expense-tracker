import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TransferDetector from "../transactions/TransferDetector";
import Select from "../ui/Select";
import StatCard from "./StatCard";
import SpendingInsights from "./SpendingInsights";
import TrendChart from "./TrendChart";
import { useCategories } from "../../contexts/CategoriesContext";
import useSWR from "swr";

// Recharts imports for mini charts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh?: () => void;
  onCategorySelect?: (categoryId: number) => void;
};

type ReportItem = {
  category_id: number | null;
  category_name: string | null;
  total: number;
};

type TimeSeriesData = {
  period: string;
  expenses: number;
  income: number;
  transaction_count: number;
};

type DashboardStats = {
  currentMonthSpending: number;
  previousMonthSpending: number;
  currentMonthIncome: number;
  previousMonthIncome: number;
  budgetRemaining: number;
  totalBudget: number;
  netBalance: number;
  savingsRate: number;
  transactionCount: number;
  avgTransactionAmount: number;
  topCategory: { name: string; amount: number } | null;
};

type CategoryBudget = {
  category_id: number;
  category_name: string;
  monthly_budget: number;
  spent: number;
  percentage: number;
  color: string;
};

type BudgetState = {
  categories: CategoryBudget[];
  totalBudget: number;
  totalSpent: number;
  overallPercentage: number;
};

const categoryColors: Record<string, string> = {
  Food: "#f59e0b",
  Transport: "#3b82f6",
  Shopping: "#ec4899",
  Entertainment: "#8b5cf6",
  Bills: "#ef4444",
  Health: "#22c55e",
  Travel: "#06b6d4",
  Education: "#6366f1",
  Groceries: "#84cc16",
  Transfers: "#64748b",
  Miscellaneous: "#94a3b8",
  Uncategorized: "#475569",
};

const getColor = (name: string | null) => {
  if (!name) return categoryColors.Uncategorized;
  return categoryColors[name] || `hsl(${(name.charCodeAt(0) * 37) % 360}, 70%, 60%)`;
};

const formatCurrency = (amount: number) => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  }
  if (absAmount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  if (absAmount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
};

const formatFullCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

function Dashboard({ apiBase, refreshKey, onRefresh, onCategorySelect }: Props) {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [trendRange, setTrendRange] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Generate last 12 months for dropdown
  const getMonthOptions = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      months.push({ value, label });
    }
    return months;
  };

  // Build URLs for SWR with memoization to prevent unnecessary re-fetches
  const summaryUrl = useMemo(() => {
    let url = `${apiBase}/reports/summary`;
    if (selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    return url;
  }, [apiBase, selectedMonth]);

  const timeSeriesUrl = useMemo(() => {
    let url = `${apiBase}/reports/timeseries?granularity=month`;
    if (selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    return url;
  }, [apiBase, selectedMonth]);

  // Previous month URL for trend comparison
  const prevMonthUrl = useMemo(() => {
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevYear = prevMonth.getFullYear();
    const prevMonthNum = prevMonth.getMonth() + 1;
    const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
    const prevStartDate = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-01`;
    const prevEndDate = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-${prevLastDay}`;
    return `${apiBase}/reports/summary?start_date=${prevStartDate}&end_date=${prevEndDate}`;
  }, [apiBase]);

  // SWR hooks for data fetching with caching
  const { data: summaryData, error: summaryError, isLoading: summaryLoading } = useSWR(
    summaryUrl,
    { keepPreviousData: true, revalidateOnFocus: false }
  );
  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useSWR(
    timeSeriesUrl,
    { keepPreviousData: true, revalidateOnFocus: false }
  );
  const { data: prevMonthData, isLoading: prevMonthLoading } = useSWR(
    prevMonthUrl,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  // Combine refreshKey with URLs to trigger re-fetch when manually refreshing
  useEffect(() => {
    // SWR will automatically re-fetch when URL changes
    // refreshKey is part of the effect dependency to trigger manual refresh
  }, [refreshKey, summaryUrl, timeSeriesUrl, prevMonthUrl]);

  // Calculate trend percentage
  const calculateTrend = (current: number, previous: number): { value: number; type: "up" | "down" | "neutral" } => {
    if (previous === 0) return { value: 0, type: "neutral" };
    const percentChange = ((current - previous) / Math.abs(previous)) * 100;
    return {
      value: Math.abs(Math.round(percentChange)),
      type: percentChange > 0 ? "up" : percentChange < 0 ? "down" : "neutral",
    };
  };

  // Derived data from SWR
  const items = useMemo(() => summaryData?.items || [], [summaryData]);
  const timeSeries = useMemo(() => timeSeriesData?.data || [], [timeSeriesData]);

  // Calculate dashboard stats
  const { dashboardStats, spendingTrend, incomeTrend } = useMemo(() => {
    const assetMovementCategories = ["Transfers", "Investments"];

    const spendingItems = items.filter(
      (i: ReportItem) => i.total < 0 && !assetMovementCategories.includes(i.category_name || "")
    );
    const incomeItems = items.filter(
      (i: ReportItem) => i.total > 0 && !assetMovementCategories.includes(i.category_name || "")
    );

    const totalSpend = Math.abs(spendingItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0));
    const totalIncome = incomeItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0);
    const cashFlow = items.reduce((sum: number, item: ReportItem) => sum + item.total, 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpend) / totalIncome) * 100 : 0;

    const topCat = spendingItems.length > 0
      ? spendingItems.reduce((max: ReportItem, item: ReportItem) =>
        Math.abs(item.total) > Math.abs(max.total) ? item : max, spendingItems[0])
      : null;

    const prevItems = prevMonthData?.items || [];
    const prevSpending = Math.abs(prevItems
      .filter((i: ReportItem) => i.total < 0 && !assetMovementCategories.includes(i.category_name || ""))
      .reduce((sum: number, item: ReportItem) => sum + item.total, 0));
    const prevIncome = prevItems
      .filter((i: ReportItem) => i.total > 0 && !assetMovementCategories.includes(i.category_name || ""))
      .reduce((sum: number, item: ReportItem) => sum + item.total, 0);

    const stats: DashboardStats = {
      currentMonthSpending: totalSpend,
      previousMonthSpending: prevSpending,
      currentMonthIncome: totalIncome,
      previousMonthIncome: prevIncome,
      budgetRemaining: totalIncome - totalSpend,
      totalBudget: totalIncome,
      netBalance: cashFlow,
      savingsRate: savingsRate,
      transactionCount: items.reduce((sum: number, item: ReportItem) => sum + (item.total < 0 ? 1 : 0), 0),
      avgTransactionAmount: spendingItems.length > 0 ? totalSpend / spendingItems.length : 0,
      topCategory: topCat ? { name: topCat.category_name || "Unknown", amount: Math.abs(topCat.total) } : null,
    };

    return {
      dashboardStats: stats,
      spendingTrend: calculateTrend(stats.currentMonthSpending, stats.previousMonthSpending),
      incomeTrend: calculateTrend(stats.currentMonthIncome, stats.previousMonthIncome),
    };
  }, [items, prevMonthData]);

  const loading = summaryLoading || timeSeriesLoading || prevMonthLoading || !summaryData;

  const budgetTrend = dashboardStats.totalBudget > 0
    ? {
      value: Math.round((dashboardStats.budgetRemaining / dashboardStats.totalBudget) * 100),
      type: "neutral" as const,
    }
    : { value: 0, type: "neutral" as const };

  // Prepare chart data for mini income vs expenses
  const miniChartData = timeSeries.slice(-6).map((d: TimeSeriesData) => ({
    name: new Date(d.period).toLocaleDateString("en-IN", { month: "short" }),
    income: d.income,
    expenses: Math.abs(d.expenses),
  }));

  // Daily trend data - using SWR with dynamic URL based on range
  const dailyTrendUrl = useMemo(() => {
    if (items.length === 0) return null;
    const now = new Date();
    const days = trendRange === "7d" ? 7 : trendRange === "30d" ? 30 : 90;
    const endDate = now.toISOString().split("T")[0];
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return `${apiBase}/reports/timeseries?start_date=${startDate}&end_date=${endDate}&granularity=day`;
  }, [apiBase, trendRange, items.length, refreshKey]);

  const { data: dailyTrendDataRaw, isLoading: loadingTrend } = useSWR(
    dailyTrendUrl,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const dailyTrendData = useMemo(() => {
    return (dailyTrendDataRaw?.data || []).map((d: TimeSeriesData) => ({
      date: new Date(d.period).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      amount: Math.abs(d.expenses),
      income: d.income,
      fullDate: d.period,
    }));
  }, [dailyTrendDataRaw]);

  // Budget calculation using useMemo (previously in useEffect)
  const budgetState = useMemo<BudgetState>(() => {
    if (items.length === 0 || categories.length === 0) {
      return {
        categories: [],
        totalBudget: 0,
        totalSpent: 0,
        overallPercentage: 0,
      };
    }

    // Create a map of category spending from current items
    const spendingByCategory = new Map<string, number>();
    items.forEach((item: ReportItem) => {
      if (item.total < 0 && item.category_id) {
        const current = spendingByCategory.get(String(item.category_id)) || 0;
        spendingByCategory.set(String(item.category_id), current + Math.abs(item.total));
      }
    });

    // Build budget state for categories with monthly budgets
    const categoriesWithBudget: CategoryBudget[] = categories
      .filter((cat) => cat.monthly_budget && cat.monthly_budget > 0)
      .map((cat) => {
        const spent = spendingByCategory.get(String(cat.id)) || 0;
        const budget = cat.monthly_budget || 0;
        const percentage = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

        return {
          category_id: cat.id,
          category_name: cat.name,
          monthly_budget: budget,
          spent: spent,
          percentage: percentage,
          color: cat.color || getColor(cat.name),
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    const totalBudget = categoriesWithBudget.reduce((sum, cat) => sum + cat.monthly_budget, 0);
    const totalSpent = categoriesWithBudget.reduce((sum, cat) => sum + cat.spent, 0);
    const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      categories: categoriesWithBudget,
      totalBudget,
      totalSpent,
      overallPercentage,
    };
  }, [items, categories]);

  const loadingBudget = false; // Always calculated immediately via useMemo

  // Categories that represent asset movements
  const assetMovementCategories = ["Transfers", "Investments"];

  // Separate items
  const spendingItems = items.filter(
    (i: ReportItem) => i.total < 0 && !assetMovementCategories.includes(i.category_name || "")
  );
  const assetItems = items.filter((i: ReportItem) => assetMovementCategories.includes(i.category_name || ""));
  const incomeItems = items.filter(
    (i: ReportItem) => i.total > 0 && !assetMovementCategories.includes(i.category_name || "")
  );

  const totalSpend = Math.abs(spendingItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0));
  const totalIncome = incomeItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0);
  const cashFlow = items.reduce((sum: number, item: ReportItem) => sum + item.total, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpend) / totalIncome) * 100 : 0;
  const totalInvested = Math.abs(
    assetItems.filter((i: ReportItem) => i.total < 0).reduce((sum: number, item: ReportItem) => sum + item.total, 0)
  );

  const uncategorized = items.find((i: ReportItem) => !i.category_name);

  if (loading) {
    return (
      <div className="page-transition-scale">
        {/* Skeleton header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="skeleton w-[200px] h-10 rounded-lg" />
        </div>

        {/* Skeleton stat cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton skeleton-card h-[140px]" />
          ))}
        </div>

        {/* Skeleton chart */}
        <div className="card">
          <div className="skeleton skeleton-card h-[300px]" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page-transition-scale grid gap-6">
        {/* Month Selector - Always visible */}
        <div className="flex items-center gap-4">
          <Select
            label="Period"
            value={selectedMonth || ""}
            onChange={(val) => setSelectedMonth(String(val))}
            options={[{ value: "", label: "All Time" }, ...getMonthOptions()]}
            className="min-w-[200px]"
          />
        </div>

        <div className="p-16 text-center bg-bg-card rounded-xl border border-dashed border-border-color">
          <div
            className="w-16 h-16 bg-accent-glow rounded-full flex items-center justify-center mx-auto mb-6 text-accent"
          >
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <h2 className="text-2xl mb-2 text-text-primary">
            {selectedMonth ? "No transactions in this period" : "Welcome to Expense Tracker!"}
          </h2>
          <p className="text-text-secondary mb-8 max-w-[400px] mx-auto leading-normal">
            {selectedMonth
              ? "Try selecting a different month from the dropdown above, or view All Time to see your complete transaction history."
              : "It looks like you haven't imported any transactions yet. Start by uploading a bank statement to see your financial analytics."}
          </p>
          {!selectedMonth && (
            <button
              className="primary"
              onClick={() => navigate("/upload")}
            >
              Import Your First Statement
            </button>
          )}
        </div>
      </div>
    );
  }

  const formatTrendLabel = (trend: { type: string; value: number }) => {
    if (trend.type === "up") return `vs last month`;
    if (trend.type === "down") return `vs last month`;
    return `vs last month`;
  };

  return (
    <div className="page-transition-scale grid gap-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Select
          label="Period"
          value={selectedMonth || ""}
          onChange={(val) => setSelectedMonth(String(val))}
          options={[{ value: "", label: "All Time" }, ...getMonthOptions()]}
          className="min-w-[200px]"
        />

        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
          />
          <span className="text-xs text-text-muted">
            Live data
          </span>
        </div>
      </div>

      {/* 🎯 Feature 1: Dashboard Spending Overview Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
        {/* Total Balance Card */}
        <StatCard
          title="Net Balance"
          value={formatFullCurrency(cashFlow)}
          subtitle={cashFlow >= 0 ? "Added to savings" : "Used savings for investments"}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          variant={cashFlow >= 0 ? "success" : "danger"}
          size="large"
        />

        {/* This Month Spending Card */}
        <StatCard
          title="Total Spent"
          value={formatCurrency(totalSpend)}
          trend={{
            value: spendingTrend.value,
            label: formatTrendLabel(spendingTrend),
            type: spendingTrend.type,
          }}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
          variant="danger"
          size="large"
        />

        {/* Total Income Card */}
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          trend={{
            value: incomeTrend.value,
            label: formatTrendLabel(incomeTrend),
            type: incomeTrend.type,
          }}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
          variant="success"
          size="large"
        />

        {/* Savings Rate Card */}
        <StatCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(0)}%`}
          subtitle={
            savingsRate >= 20
              ? "Great job! >20% is excellent"
              : savingsRate >= 10
                ? "Good progress toward 20%"
                : "Aim for at least 20% savings"
          }
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          variant={savingsRate >= 20 ? "success" : savingsRate >= 10 ? "warning" : "default"}
          size="large"
        />
      </div>

      {/* Income vs Expenses Mini Chart */}
      {miniChartData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Income vs Expenses Trend</h2>
            <span className="text-sm text-text-muted">
              Last {miniChartData.length} months
            </span>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={miniChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                  }}
                  formatter={(value: number) => formatFullCurrency(value)}
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Feature 10: Spending Insights */}
      <div className="card">
        <div className="card-header">
          <h2>Spending Insights</h2>
        </div>
        <SpendingInsights
          apiBase={apiBase}
          categories={categories}
          refreshKey={refreshKey}
        />
      </div>

      {/* Daily Expense Trend Chart - Feature 3 & Feature 5: Mobile-Optimized TrendChart */}
      <div className="card">
        <div className="card-header">
          <h2>Expense Trend</h2>
        </div>
        <TrendChart
          data={dailyTrendData}
          loading={loadingTrend}
          range={trendRange}
          onRangeChange={setTrendRange}
          formatCurrency={formatCurrency}
          formatFullCurrency={formatFullCurrency}
        />
      </div>

      {/* 📊 Feature 6 - Budget Progress Bars */}
      {budgetState.categories.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Budget Progress</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-muted">
                {formatCurrency(budgetState.totalSpent)} / {formatCurrency(budgetState.totalBudget)}
              </span>
              <div className="w-[100px] h-1.5 rounded-full bg-bg-input overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, budgetState.overallPercentage)}%`,
                    background:
                      budgetState.overallPercentage > 100
                        ? "#ef4444"
                        : budgetState.overallPercentage > 80
                          ? "#f59e0b"
                          : "#10b981",
                  }}
                />
              </div>
              <span
                className="text-xs font-semibold"
                style={{
                  color:
                    budgetState.overallPercentage > 100
                      ? "#ef4444"
                      : budgetState.overallPercentage > 80
                        ? "#f59e0b"
                        : "#10b981",
                }}
              >
                {budgetState.overallPercentage.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Overall Budget Bar */}
          <div className="mb-6 p-4 bg-bg-input rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-text-primary">
                Overall Budget
              </span>
              <span className="text-sm text-text-muted">
                {budgetState.overallPercentage > 100 ? (
                  <span className="text-danger font-medium">
                    Over budget by {formatCurrency(budgetState.totalSpent - budgetState.totalBudget)}
                  </span>
                ) : (
                  <span className="text-success font-medium">
                    {formatCurrency(budgetState.totalBudget - budgetState.totalSpent)} remaining
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-2 rounded bg-black/10 overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${Math.min(100, budgetState.overallPercentage)}%`,
                  background:
                    budgetState.overallPercentage > 100
                      ? "linear-gradient(90deg, #ef4444, #dc2626)"
                      : budgetState.overallPercentage > 80
                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                        : "linear-gradient(90deg, #10b981, #059669)",
                  boxShadow:
                    budgetState.overallPercentage > 90
                      ? "0 0 10px rgba(239, 68, 68, 0.5)"
                      : "none",
                }}
              />
            </div>
          </div>

          {/* Category Budget Bars */}
          <div className="grid gap-4">
            {loadingBudget ? (
              <div className="text-center p-8 text-text-muted">
                Loading budget data...
              </div>
            ) : (
              budgetState.categories.map((cat) => {
                const isOverBudget = cat.percentage > 100;
                const isNearLimit = cat.percentage > 80 && cat.percentage <= 100;
                const remaining = cat.monthly_budget - cat.spent;

                return (
                  <div
                    key={cat.category_id}
                    onClick={() => onCategorySelect?.(cat.category_id)}
                    className={`grid gap-2 p-4 bg-bg-input rounded-lg transition-all ${onCategorySelect ? "cursor-pointer hover:bg-bg-hover" : ""} ${isOverBudget ? "border border-red-500/30" : "border border-transparent"}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: cat.color }}
                        />
                        <span className="text-sm font-medium text-text-primary">
                          {cat.category_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text-muted">
                          {formatCurrency(cat.spent)} / {formatCurrency(cat.monthly_budget)}
                        </span>
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded"
                          style={{
                            background: isOverBudget
                              ? "rgba(239, 68, 68, 0.15)"
                              : isNearLimit
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(16, 185, 129, 0.15)",
                            color: isOverBudget ? "#ef4444" : isNearLimit ? "#f59e0b" : "#10b981",
                          }}
                        >
                          {cat.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${Math.min(100, cat.percentage)}%`,
                          background: cat.color,
                          opacity: isOverBudget ? 0.8 : 1,
                        }}
                      />
                    </div>

                    {/* Status Message */}
                    <div className="text-xs">
                      {isOverBudget ? (
                        <span className="text-danger font-medium">
                          ⚠️ Over budget by {formatCurrency(cat.spent - cat.monthly_budget)}
                        </span>
                      ) : isNearLimit ? (
                        <span className="text-warning">
                          ⚡ Only {formatCurrency(remaining)} remaining
                        </span>
                      ) : (
                        <span className="text-text-muted">
                          {formatCurrency(remaining)} remaining
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {/* Transactions Count */}
        <StatCard
          title="Transactions"
          value={dashboardStats.transactionCount.toLocaleString()}
          subtitle="This period"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
          variant="default"
          size="small"
        />

        {/* Average Transaction */}
        <StatCard
          title="Avg. Transaction"
          value={formatCurrency(dashboardStats.avgTransactionAmount)}
          subtitle="Per transaction"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          }
          variant="default"
          size="small"
        />

        {/* Top Category */}
        <StatCard
          title="Top Category"
          value={dashboardStats.topCategory?.name || "—"}
          subtitle={dashboardStats.topCategory ? formatCurrency(dashboardStats.topCategory.amount) : "No spending yet"}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          }
          variant="purple"
          size="small"
        />

        {/* Investments */}
        {totalInvested > 0 && (
          <StatCard
            title="Invested"
            value={formatCurrency(totalInvested)}
            subtitle="Assets & transfers"
            icon={
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            }
            variant="purple"
            size="small"
          />
        )}

        {/* Uncategorized */}
        {uncategorized && (
          <StatCard
            title="Uncategorized"
            value={formatCurrency(Math.abs(uncategorized.total))}
            subtitle="Needs attention"
            icon={
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            variant="warning"
            size="small"
          />
        )}
      </div>

      {/* Spending Breakdown */}
      {spendingItems.length > 0 && (
        <div className="card page-transition-scale">
          <div className="card-header">
            <h2>Spending by Category</h2>
            <span className="text-sm text-text-muted">
              Click to view details
            </span>
          </div>

          {/* Visual bar chart */}
          <div className="mb-6">
            <div className="flex h-3 rounded-full overflow-hidden bg-bg-input">
              {spendingItems.map((item: ReportItem, idx: number) => {
                const percentage = totalSpend > 0 ? (Math.abs(item.total) / totalSpend) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      background: getColor(item.category_name),
                    }}
                    title={`${item.category_name}: ${formatCurrency(Math.abs(item.total))}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Category list */}
          <div className="grid gap-3">
            {spendingItems.map((item: ReportItem, idx: number) => {
              const percentage = totalSpend > 0 ? (Math.abs(item.total) / totalSpend) * 100 : 0;
              const isClickable = item.category_id && onCategorySelect;
              return (
                <div
                  key={idx}
                  onClick={() => isClickable && onCategorySelect(item.category_id!)}
                  className={`flex items-center gap-4 px-4 py-3.5 bg-bg-input rounded-lg transition-all ${isClickable ? "cursor-pointer hover:bg-bg-hover" : ""}`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: getColor(item.category_name) }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-text-primary text-sm">
                      {item.category_name || "Uncategorized"}
                    </div>
                  </div>
                  <div className="text-sm text-text-muted w-[50px] text-right">
                    {percentage.toFixed(1)}%
                  </div>
                  <div
                    className="mono font-medium text-text-primary w-[100px] text-right text-sm"
                  >
                    {formatCurrency(Math.abs(item.total))}
                  </div>
                  {isClickable && (
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="var(--text-muted)"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Income Breakdown */}
      {incomeItems.length > 0 && (
        <div className="card page-transition-scale">
          <div className="card-header">
            <h2>Income Sources</h2>
          </div>
          <div className="grid gap-3">
            {incomeItems.map((item: ReportItem, idx: number) => {
              const percentage = totalIncome > 0 ? (item.total / totalIncome) * 100 : 0;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 px-4 py-3.5 bg-bg-input rounded-lg"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-text-primary text-sm">
                      {item.category_name || "Other Income"}
                    </div>
                  </div>
                  <div className="text-sm text-text-muted w-[50px] text-right">
                    {percentage.toFixed(1)}%
                  </div>
                  <div
                    className="mono font-medium text-accent w-[100px] text-right text-sm"
                  >
                    {formatCurrency(item.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset Movements */}
      {assetItems.length > 0 && (
        <div className="card page-transition-scale opacity-85">
          <div className="card-header">
            <h2>Asset Movements</h2>
            <span className="text-xs text-text-muted">
              Investments & transfers (not counted in spending)
            </span>
          </div>
          <div className="grid gap-3">
            {assetItems.map((item: ReportItem, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-4 px-4 py-3.5 bg-bg-input rounded-lg"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: item.category_name === "Investments" ? "#8b5cf6" : "#64748b" }}
                />
                <div className="flex-1">
                  <div className="font-medium text-text-secondary text-sm">
                    {item.category_name}
                  </div>
                </div>
                <div
                  className="mono font-medium w-[100px] text-right text-sm"
                  style={{ color: item.total < 0 ? "#8b5cf6" : "var(--accent)" }}
                >
                  {formatCurrency(Math.abs(item.total))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Detection */}
      <TransferDetector
        apiBase={apiBase}
        refreshKey={refreshKey}
        onRefresh={onRefresh || (() => { })}
      />
    </div>
  );
}

export default Dashboard;