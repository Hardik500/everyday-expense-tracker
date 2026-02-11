import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import TransferDetector from "./TransferDetector";
import Select from "./ui/Select";
import StatCard, { Sparkline } from "./StatCard";
import type { Category } from "../App";

// Recharts imports for mini charts
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  CartesianGrid,
  Legend,
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
  const [items, setItems] = useState<ReportItem[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    currentMonthSpending: 0,
    previousMonthSpending: 0,
    currentMonthIncome: 0,
    previousMonthIncome: 0,
    budgetRemaining: 0,
    totalBudget: 0,
    netBalance: 0,
    savingsRate: 0,
    transactionCount: 0,
    avgTransactionAmount: 0,
    topCategory: null,
  });

  // Trend chart data
  const [dailyTrendData, setDailyTrendData] = useState<Array<{ date: string; amount: number; income: number }>>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

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

  // Calculate trend percentage
  const calculateTrend = (current: number, previous: number): { value: number; type: "up" | "down" | "neutral" } => {
    if (previous === 0) return { value: 0, type: "neutral" };
    const percentChange = ((current - previous) / Math.abs(previous)) * 100;
    return {
      value: Math.abs(Math.round(percentChange)),
      type: percentChange > 0 ? "up" : percentChange < 0 ? "down" : "neutral",
    };
  };

  useEffect(() => {
    if (items.length === 0) {
      setLoading(true);
    }
    
    const fetchData = async () => {
      try {
        // Get current period data
        let summaryUrl = `${apiBase}/reports/summary`;
        let timeSeriesUrl = `${apiBase}/reports/timeseries?granularity=month`;

        if (selectedMonth) {
          const [year, month] = selectedMonth.split("-");
          const startDate = `${year}-${month}-01`;
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
          const endDate = `${year}-${month}-${lastDay}`;
          summaryUrl += `?start_date=${startDate}&end_date=${endDate}`;
          timeSeriesUrl += `&start_date=${startDate}&end_date=${endDate}`;
        }

        const [summaryRes, timeSeriesRes] = await Promise.all([
          fetchWithAuth(summaryUrl),
          fetchWithAuth(timeSeriesUrl),
        ]);

        const summaryData = await summaryRes.json();
        const timeSeriesData = await timeSeriesRes.json();

        const currentItems = summaryData.items || [];
        setItems(currentItems);
        setTimeSeries(timeSeriesData.data || []);

        // Calculate dashboard stats
        const assetMovementCategories = ["Transfers", "Investments"];
        
        // Current period calculations
        const spendingItems = currentItems.filter(
          (i: ReportItem) => i.total < 0 && !assetMovementCategories.includes(i.category_name || "")
        );
        const incomeItems = currentItems.filter(
          (i: ReportItem) => i.total > 0 && !assetMovementCategories.includes(i.category_name || "")
        );
        
        const totalSpend = Math.abs(spendingItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0));
        const totalIncome = incomeItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0);
        const cashFlow = currentItems.reduce((sum: number, item: ReportItem) => sum + item.total, 0);
        const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpend) / totalIncome) * 100 : 0;
        
        // Find top category
        const topCat = spendingItems.length > 0 
          ? spendingItems.reduce((max: ReportItem, item: ReportItem) => 
              Math.abs(item.total) > Math.abs(max.total) ? item : max, spendingItems[0])
          : null;

        // For trend calculation, we'd need previous month data
        const prevMonth = new Date();
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        
        // Fetch previous month for comparison
        const prevYear = prevMonth.getFullYear();
        const prevMonthNum = prevMonth.getMonth() + 1;
        const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
        const prevStartDate = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-01`;
        const prevEndDate = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-${prevLastDay}`;
        
        const prevRes = await fetchWithAuth(
          `${apiBase}/reports/summary?start_date=${prevStartDate}&end_date=${prevEndDate}`
        );
        const prevData = await prevRes.json();
        const prevItems = prevData.items || [];
        
        const prevSpending = Math.abs(prevItems
          .filter((i: ReportItem) => i.total < 0 && !assetMovementCategories.includes(i.category_name || ""))
          .reduce((sum: number, item: ReportItem) => sum + item.total, 0));
          
        const prevIncome = prevItems
          .filter((i: ReportItem) => i.total > 0 && !assetMovementCategories.includes(i.category_name || ""))
          .reduce((sum: number, item: ReportItem) => sum + item.total, 0);

        setDashboardStats({
          currentMonthSpending: totalSpend,
          previousMonthSpending: prevSpending,
          currentMonthIncome: totalIncome,
          previousMonthIncome: prevIncome,
          budgetRemaining: totalIncome - totalSpend,
          totalBudget: totalIncome,
          netBalance: cashFlow,
          savingsRate: savingsRate,
          transactionCount: currentItems.reduce((sum: number, item: ReportItem) => sum + (item.total < 0 ? 1 : 0), 0),
          avgTransactionAmount: spendingItems.length > 0 ? totalSpend / spendingItems.length : 0,
          topCategory: topCat ? { name: topCat.category_name || "Unknown", amount: Math.abs(topCat.total) } : null,
        });

        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [apiBase, refreshKey, selectedMonth]);

  // Calculate trends
  const spendingTrend = calculateTrend(
    dashboardStats.currentMonthSpending,
    dashboardStats.previousMonthSpending
  );
  const incomeTrend = calculateTrend(
    dashboardStats.currentMonthIncome,
    dashboardStats.previousMonthIncome
  );
  const budgetTrend = dashboardStats.totalBudget > 0
    ? {
        value: Math.round((dashboardStats.budgetRemaining / dashboardStats.totalBudget) * 100),
        type: "neutral" as const,
      }
    : { value: 0, type: "neutral" as const };

  // Prepare chart data for mini income vs expenses
  const miniChartData = timeSeries.slice(-6).map((d) => ({
    name: new Date(d.period).toLocaleDateString("en-IN", { month: "short" }),
    income: d.income,
    expenses: Math.abs(d.expenses),
  }));

  useEffect(() => {
    const fetchDailyTrend = async () => {
      setLoadingTrend(true);
      try {
        const now = new Date();
        const days = trendRange === "7d" ? 7 : trendRange === "30d" ? 30 : 90;
        const endDate = now.toISOString().split("T")[0];
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const res = await fetchWithAuth(
          `${apiBase}/reports/timeseries?start_date=${startDate}&end_date=${endDate}&granularity=day`
        );
        const data = await res.json();
        
        // Process the daily data
        const trendData = (data.data || []).map((d: TimeSeriesData) => ({
          date: new Date(d.period).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          amount: Math.abs(d.expenses),
          income: d.income,
          fullDate: d.period,
        }));
        
        setDailyTrendData(trendData);
      } catch (err) {
        console.error("Failed to fetch daily trend:", err);
      }
      setLoadingTrend(false);
    };
    
    if (items.length > 0) {
      fetchDailyTrend();
    }
  }, [trendRange, apiBase, items.length, refreshKey]);

  // Categories that represent asset movements
  const assetMovementCategories = ["Transfers", "Investments"];

  // Separate items
  const spendingItems = items.filter(
    (i) => i.total < 0 && !assetMovementCategories.includes(i.category_name || "")
  );
  const assetItems = items.filter((i) => assetMovementCategories.includes(i.category_name || ""));
  const incomeItems = items.filter(
    (i) => i.total > 0 && !assetMovementCategories.includes(i.category_name || "")
  );

  const totalSpend = Math.abs(spendingItems.reduce((sum, item) => sum + item.total, 0));
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.total, 0);
  const cashFlow = items.reduce((sum, item) => sum + item.total, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpend) / totalIncome) * 100 : 0;
  const totalInvested = Math.abs(
    assetItems.filter((i) => i.total < 0).reduce((sum, item) => sum + item.total, 0)
  );

  const uncategorized = items.find((i) => !i.category_name);

  if (loading) {
    return (
      <div className="page-transition-scale">
        {/* Skeleton header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="skeleton" style={{ width: 200, height: 40, borderRadius: 8 }} />
        </div>

        {/* Skeleton stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: 140 }} />
          ))}
        </div>

        {/* Skeleton chart */}
        <div className="card">
          <div className="skeleton skeleton-card" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
        {/* Month Selector - Always visible */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Select
            label="Period"
            value={selectedMonth || ""}
            onChange={(val) => setSelectedMonth(String(val))}
            options={[{ value: "", label: "All Time" }, ...getMonthOptions()]}
            style={{ minWidth: 200 }}
          />
        </div>

        <div
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--border-color)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              background: "var(--accent-glow)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              color: "var(--accent)",
            }}
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
          <h2
            style={{
              fontSize: "1.5rem",
              marginBottom: "0.5rem",
              color: "var(--text-primary)",
            }}
          >
            {selectedMonth ? "No transactions in this period" : "Welcome to Expense Tracker!"}
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "2rem",
              maxWidth: 400,
              margin: "0 auto 2rem",
              lineHeight: 1.5,
            }}
          >
            {selectedMonth
              ? "Try selecting a different month from the dropdown above, or view All Time to see your complete transaction history."
              : "It looks like you haven't imported any transactions yet. Start by uploading a bank statement to see your financial analytics."}
          </p>
          {!selectedMonth && (
            <button
              className="primary"
              onClick={() => (window as any).showTab("upload")}
              style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
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
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      {/* Header with Period Selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <Select
          label="Period"
          value={selectedMonth || ""}
          onChange={(val) => setSelectedMonth(String(val))}
          options={[{ value: "", label: "All Time" }, ...getMonthOptions()]}
          style={{ minWidth: 200 }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#10b981",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Live data
          </span>
        </div>
      </div>

      {/* 🎯 Feature 1: Dashboard Spending Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
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
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Last {miniChartData.length} months
            </span>
          </div>
          <div style={{ height: 180 }}>
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

      {/* Daily Expense Trend Chart - Feature 5 */}
      <div className="card">
        <div className="card-header">
          <h2>Expense Trend</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTrendRange(range)}
                className={trendRange === range ? "primary" : "secondary"}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 250 }}>
          {loadingTrend ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              Loading trend data...
            </div>
          ) : dailyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyTrendData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={11}
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
                  formatter={(value: number, name: string) => [
                    formatFullCurrency(value),
                    name === "amount" ? "Expenses" : name,
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: "#ef4444", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#ef4444" }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              No data available for selected period
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
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
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Click to view details
            </span>
          </div>

          {/* Visual bar chart */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                height: 12,
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--bg-input)",
              }}
            >
              {spendingItems.map((item, idx) => {
                const percentage = totalSpend > 0 ? (Math.abs(item.total) / totalSpend) * 100 : 0;
                return (
                  <div
                    key={idx}
                    style={{
                      width: `${percentage}%`,
                      background: getColor(item.category_name),
                      transition: "width 0.5s ease",
                    }}
                    title={`${item.category_name}: ${formatCurrency(Math.abs(item.total))}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Category list */}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {spendingItems.map((item, idx) => {
              const percentage = totalSpend > 0 ? (Math.abs(item.total) / totalSpend) * 100 : 0;
              const isClickable = item.category_id && onCategorySelect;
              return (
                <div
                  key={idx}
                  onClick={() => isClickable && onCategorySelect(item.category_id!)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 1rem",
                    background: "var(--bg-input)",
                    borderRadius: "var(--radius-md)",
                    transition: "all var(--transition-fast)",
                    cursor: isClickable ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) =>
                    isClickable && (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    isClickable && (e.currentTarget.style.background = "var(--bg-input)")
                  }
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: getColor(item.category_name),
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      {item.category_name || "Uncategorized"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-muted)",
                      width: 50,
                      textAlign: "right",
                    }}
                  >
                    {percentage.toFixed(1)}%
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      width: 100,
                      textAlign: "right",
                      fontSize: "0.875rem",
                    }}
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
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {incomeItems.map((item, idx) => {
              const percentage = totalIncome > 0 ? (item.total / totalIncome) * 100 : 0;
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 1rem",
                    background: "var(--bg-input)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      {item.category_name || "Other Income"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-muted)",
                      width: 50,
                      textAlign: "right",
                    }}
                  >
                    {percentage.toFixed(1)}%
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontWeight: 500,
                      color: "var(--accent)",
                      width: 100,
                      textAlign: "right",
                      fontSize: "0.875rem",
                    }}
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
        <div className="card page-transition-scale" style={{ opacity: 0.85 }}>
          <div className="card-header">
            <h2>Asset Movements</h2>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Investments & transfers (not counted in spending)
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {assetItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 1rem",
                  background: "var(--bg-input)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: item.category_name === "Investments" ? "#8b5cf6" : "#64748b",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      fontSize: "0.875rem",
                    }}
                  >
                    {item.category_name}
                  </div>
                </div>
                <div
                  className="mono"
                  style={{
                    fontWeight: 500,
                    color: item.total < 0 ? "#8b5cf6" : "var(--accent)",
                    width: 100,
                    textAlign: "right",
                    fontSize: "0.875rem",
                  }}
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
        onRefresh={onRefresh || (() => {})}
      />
    </div>
  );
}

export default Dashboard;
