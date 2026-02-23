import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Category, Subcategory, Transaction as BaseTransaction } from "../types";
import EditTransactionModal from "../transactions/EditTransactionModal";
import Select from "../ui/Select";
import { PageLoading } from "../ui/Loading";

type Transaction = BaseTransaction & {
  subcategory_name?: string | null;
};

type Props = {
  apiBase: string;
  refreshKey: number;
  initialCategoryId?: number | null;
  categories?: Category[];
  subcategories?: Subcategory[];
  onRefresh?: () => void;
};

type TimeSeriesData = {
  period: string;
  expenses: number;
  income: number;
  transaction_count: number;
};

type StatsData = {
  total_expenses: number;
  total_income: number;
  net_balance: number;
  transaction_count: number;
  avg_expense: number;
  top_categories: { name: string; total: number; id?: number }[];
  data_min_date: string | null;
  data_max_date: string | null;
};

type CategoryDetail = {
  category: { id: number; name: string };
  total: number;
  count: number;
  average: number;
  subcategories: { id: number; name: string; total: number; count: number }[];
  timeseries: { period: string; amount: number; count: number }[];
  transactions: Transaction[];
};

type DateRange = "7d" | "30d" | "90d" | "year" | "2yr" | "3yr" | "5yr" | "all" | "custom";

type Account = {
  id: number;
  name: string;
  type: string;
};

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
};

const formatFullCurrency = (value: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string, includeYear: boolean = false) => {
  const date = new Date(dateStr);
  if (includeYear) {
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// Wrapper for XAxis tickFormatter - always includes year for clarity
const formatDateAxis = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const TransactionRow = ({ tx, onClick }: { tx: Transaction; onClick: (tx: Transaction) => void }) => {
  return (
    <tr
      onClick={() => onClick(tx)}
      className="cursor-pointer transition-colors hover:bg-bg-hover"
    >
      <td className="px-4 py-3 text-sm text-text-muted">
        {formatDate(tx.posted_at)}
      </td>
      <td className="px-4 py-3 text-sm max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
        {tx.description_raw}
      </td>
      <td className="px-4 py-3">
        {tx.subcategory_name ? (
          <span className="badge text-xs">{tx.subcategory_name}</span>
        ) : (
          <span className="text-text-muted text-sm">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="mono text-danger font-medium">
          -{formatCurrency(tx.amount)}
        </span>
      </td>
    </tr>
  );
};

function Analytics({ apiBase, refreshKey, initialCategoryId, categories = [], subcategories = [], onRefresh }: Props) {
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  // Initialize from URL
  const getParams = () => new URLSearchParams(window.location.search);

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const p = getParams();
    if (p.get("start") || p.get("end")) return "custom";
    if (p.get("range")) return p.get("range") as DateRange;
    return "30d"; // Default to Last 30 Days
  });

  const [granularity, setGranularity] = useState<"day" | "week" | "month">("month");

  const [customStart, setCustomStart] = useState(() => getParams().get("start") || "");
  const [customEnd, setCustomEnd] = useState(() => getParams().get("end") || "");

  // Category drill-down state
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(() => {
    const p = getParams();
    if (p.get("cat")) return Number(p.get("cat"));
    return initialCategoryId ?? null;
  });
  const [categoryDetail, setCategoryDetail] = useState<CategoryDetail | null>(null);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Account filter state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(() => {
    const p = getParams();
    return p.get("account") ? Number(p.get("account")) : null;
  });

  const getDateParams = () => {
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString().split("T")[0];

    switch (dateRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "2yr":
        startDate = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "3yr":
        startDate = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "5yr":
        startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "all":
        startDate = "2000-01-01";
        break;
      case "custom":
        startDate = customStart;
        endDate = customEnd || endDate;
        break;
    }

    return { startDate, endDate };
  };

  // Fetch categories - REMOVED, using props
  /*
  useEffect(() => {
    fetch(`${apiBase}/categories`)
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, [apiBase]);
  */

  // Fetch accounts for filter
  useEffect(() => {
    fetchWithAuth(`${apiBase}/accounts`)
      .then(res => res.json())
      .then(data => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]));
  }, [apiBase]);

  // Fetch main data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { startDate, endDate } = getDateParams();
      const accountParam = selectedAccountId ? `&account_id=${selectedAccountId}` : "";

      try {
        const [tsRes, statsRes] = await Promise.all([
          fetchWithAuth(`${apiBase}/reports/timeseries?start_date=${startDate}&end_date=${endDate}&granularity=${granularity}${accountParam}`),
          fetchWithAuth(`${apiBase}/reports/stats?start_date=${startDate}&end_date=${endDate}${accountParam}`),
        ]);

        const tsData = await tsRes.json();
        const statsData = await statsRes.json();

        setTimeSeries(tsData.data || []);
        setStats(statsData);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [apiBase, refreshKey, dateRange, granularity, customStart, customEnd, selectedAccountId]);

  // Fetch category detail when selected
  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryDetail(null);
      return;
    }

    const fetchCategoryDetail = async () => {
      setLoadingCategory(true);
      const { startDate, endDate } = getDateParams();
      const accountParam = selectedAccountId ? `&account_id=${selectedAccountId}` : "";

      try {
        const res = await fetchWithAuth(
          `${apiBase}/reports/category/${selectedCategoryId}?start_date=${startDate}&end_date=${endDate}${accountParam}`
        );
        const data = await res.json();
        setCategoryDetail(data);
      } catch (err) {
        console.error("Failed to fetch category detail:", err);
        setCategoryDetail(null);
      }
      setLoadingCategory(false);
    };

    fetchCategoryDetail();
  }, [apiBase, selectedCategoryId, dateRange, customStart, customEnd, refreshKey, selectedAccountId]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Preserve tab
    if (!params.get("tab")) params.set("tab", "analytics");

    params.set("range", dateRange);

    if (dateRange === "custom") {
      if (customStart) params.set("start", customStart);
      else params.delete("start");
      if (customEnd) params.set("end", customEnd);
      else params.delete("end");
    } else {
      params.delete("start");
      params.delete("end");
    }

    if (selectedCategoryId) {
      params.set("cat", selectedCategoryId.toString());
    } else {
      params.delete("cat");
    }

    if (selectedAccountId) {
      params.set("account", selectedAccountId.toString());
    } else {
      params.delete("account");
    }

    const newUrl = "?" + params.toString();
    if (window.location.search !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [dateRange, customStart, customEnd, selectedCategoryId, selectedAccountId]);

  // Auto-adjust granularity based on date range
  useEffect(() => {
    let targetGranularity: "day" | "week" | "month" = "month";

    if (dateRange === "7d" || dateRange === "30d") targetGranularity = "day";
    else if (dateRange === "90d") targetGranularity = "week";
    else if (dateRange === "year" || dateRange === "all" || dateRange === "2yr" || dateRange === "3yr" || dateRange === "5yr") targetGranularity = "month";

    // Only update if it actually changed to prevent double-render
    if (targetGranularity !== granularity) {
      setGranularity(targetGranularity);
    }
  }, [dateRange, granularity]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const hasIncome = payload.some((p: any) => p.name === "Income" && p.value > 0);
      const hasExpenses = payload.some((p: any) => p.name === "Expenses" && p.value > 0);
      const hasData = hasIncome || hasExpenses;

      return (
        <div className="bg-bg-card border border-border-color rounded-lg px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          <p className="font-medium mb-2 text-text-primary">
            {formatDate(label)}
          </p>
          {!hasData ? (
            <p className="text-text-muted text-sm italic">
              No transactions
            </p>
          ) : (
            payload.map((entry: any, index: number) => (
              entry.value > 0 && (
                <p key={index} className="text-sm my-1" style={{ color: entry.color }}>
                  {entry.name}: {formatFullCurrency(entry.value)}
                </p>
              )
            ))
          )}
        </div>
      );
    }
    return null;
  };

  if (loading && !stats) {
    return <PageLoading text="Loading analytics..." />;
  }

  return (
    <div className="grid gap-6">
      {/* Date Range Selector */}
      <div className="card px-5 py-4">
        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex gap-2 flex-wrap">
            {(["7d", "30d", "90d", "year", "2yr", "3yr", "5yr", "all"] as DateRange[]).map((range) => (
              <button
                key={range}
                className={dateRange === range ? "primary" : "secondary"}
                onClick={() => setDateRange(range)}
              >
                {range === "7d" ? "7 Days" :
                  range === "30d" ? "30 Days" :
                    range === "90d" ? "90 Days" :
                      range === "year" ? "1 Year" :
                        range === "2yr" ? "2 Years" :
                          range === "3yr" ? "3 Years" :
                            range === "5yr" ? "5 Years" : "All Time"}
              </button>
            ))}
            <button
              className={dateRange === "custom" ? "primary" : "secondary"}
              onClick={() => setDateRange("custom")}
            >
              Custom
            </button>
          </div>

          {dateRange === "custom" && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-2 text-sm"
              />
              <span className="text-text-muted">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-2 text-sm"
              />
            </div>
          )}

          <div className="ml-auto flex gap-3 items-center">
            {/* Account Filter */}
            <Select
              value={selectedAccountId || ""}
              onChange={(val) => setSelectedAccountId(val ? Number(val) : null)}
              options={[
                { value: "", label: "All Accounts" },
                ...accounts.map((acc) => ({ value: acc.id, label: acc.name }))
              ]}
              placeholder="Accounts"
              className="min-w-[150px]"
            />

            {/* Category Filter */}
            <Select
              value={selectedCategoryId || ""}
              onChange={(val) => setSelectedCategoryId(val ? Number(val) : null)}
              options={[
                { value: "", label: "All Categories" },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name }))
              ]}
              placeholder="Categories"
              className="min-w-[150px]"
            />

            <Select
              value={granularity}
              onChange={(val: any) => setGranularity(val)}
              options={[
                { value: "day", label: "Daily" },
                { value: "week", label: "Weekly" },
                { value: "month", label: "Monthly" },
              ]}
              placeholder="Duration"
              className="min-w-[120px]"
            />
          </div>
        </div>
      </div>

      {/* Category Detail View */}
      {selectedCategoryId && categoryDetail && (
        <div className="grid gap-6">
          {/* Category Header */}
          <div className="card p-5">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="m-0 text-text-primary">{categoryDetail.category.name}</h2>
                <p className="mt-1 mb-0 text-sm text-text-muted">
                  {categoryDetail.count} transactions in selected period
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => setSelectedCategoryId(null)}
              >
                ← Back to Overview
              </button>
            </div>
          </div>

          {/* Category Stats */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
            <div className="card p-5">
              <div className="text-sm text-text-muted mb-2">
                Total Spent
              </div>
              <div className="mono text-2xl font-semibold text-danger">
                {formatFullCurrency(categoryDetail.total)}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-text-muted mb-2">
                Transactions
              </div>
              <div className="text-2xl font-semibold text-text-primary">
                {categoryDetail.count}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-text-muted mb-2">
                Average
              </div>
              <div className="mono text-2xl font-semibold text-text-primary">
                {formatFullCurrency(categoryDetail.average)}
              </div>
            </div>
          </div>

          {/* Subcategory Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="card">
              <div className="card-header">
                <h2>Subcategory Breakdown</h2>
              </div>
              <div className="h-[300px]">
                {categoryDetail.subcategories.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDetail.subcategories}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={2}
                        label={({ name, percent }) => {
                          const val = `${(percent * 100).toFixed(0)}%`;
                          return name.length > 15 ? `${name.slice(0, 12)}... ${val}` : `${name} ${val}`;
                        }}
                        labelLine={true}
                      >
                        {categoryDetail.subcategories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatFullCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted">
                    No subcategory data
                  </div>
                )}
              </div>
            </div>

            {/* Subcategory List */}
            <div className="card">
              <div className="card-header">
                <h2>Subcategories</h2>
              </div>
              <div className="max-h-[300px] overflow-auto">
                {categoryDetail.subcategories.length > 0 ? (
                  <div className="grid gap-2">
                    {categoryDetail.subcategories.map((sub, index) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 px-4 py-3 bg-bg-input rounded-lg"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded flex-shrink-0"
                          style={{ background: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1">
                          <div className="text-sm text-text-primary font-medium">
                            {sub.name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {sub.count} transactions
                          </div>
                        </div>
                        <div className="mono text-sm text-danger">
                          {formatCurrency(sub.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-text-muted">
                    No subcategories found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Category Trend */}
          <div className="card">
            <div className="card-header">
              <h2>Spending Trend</h2>
            </div>
            <div className="h-[250px]">
              {categoryDetail.timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={categoryDetail.timeseries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCategory" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={12} tickFormatter={formatDateAxis} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={formatCurrency} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Spending"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorCategory)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  No trend data
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card">
            <div className="card-header">
              <h2>Recent Transactions</h2>
            </div>
            <div className="max-h-[400px] overflow-auto">
              {categoryDetail.transactions.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Description</th>
                      <th className="text-left px-4 py-3">Subcategory</th>
                      <th className="text-right px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryDetail.transactions.map((tx) => (
                      <TransactionRow key={tx.id} tx={tx} onClick={setEditingTx} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-text-muted">
                  No transactions found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Overview (when no category selected) */}
      {!selectedCategoryId && (
        <>
          {/* Summary Stats */}
          {stats && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <div className="card p-5">
                <div className="text-sm text-text-muted mb-2">
                  Total Income
                </div>
                <div className="mono text-2xl font-semibold text-success">
                  {formatFullCurrency(stats.total_income)}
                </div>
              </div>
              <div className="card p-5">
                <div className="text-sm text-text-muted mb-2">
                  Total Expenses
                </div>
                <div className="mono text-2xl font-semibold text-danger">
                  {formatFullCurrency(stats.total_expenses)}
                </div>
              </div>
              <div className="card p-5">
                <div className="text-sm text-text-muted mb-2">
                  Net Balance
                </div>
                <div className="mono text-2xl font-semibold" style={{ color: stats.net_balance >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {formatFullCurrency(stats.net_balance)}
                </div>
              </div>
              <div className="card p-5">
                <div className="text-sm text-text-muted mb-2">
                  Avg. Transaction
                </div>
                <div className="mono text-2xl font-semibold text-text-primary">
                  {formatFullCurrency(stats.avg_expense)}
                </div>
              </div>
            </div>
          )}

          {/* Income vs Expenses Chart */}
          <div className="card">
            <div className="card-header">
              <h2>Income vs Expenses</h2>
            </div>
            <div className="h-[350px]">
              {timeSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="period"
                      stroke="var(--text-muted)"
                      fontSize={12}
                      tickFormatter={formatDateAxis}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={12}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                      strokeWidth={2}
                      connectNulls={true}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorExpenses)"
                      strokeWidth={2}
                      connectNulls={true}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  No data for selected period
                </div>
              )}
            </div>
          </div>

          {/* Bar Chart - Daily/Weekly/Monthly comparison */}
          <div className="card">
            <div className="card-header">
              <h2>Spending Pattern</h2>
            </div>
            <div className="h-[300px]">
              {timeSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="period"
                      stroke="var(--text-muted)"
                      fontSize={12}
                      tickFormatter={formatDateAxis}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={12}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  No data for selected period
                </div>
              )}
            </div>
          </div>

          {/* Top Categories - Clickable */}
          {stats && stats.top_categories.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2>Top Spending Categories</h2>
                <span className="text-sm text-text-muted">Click to view details</span>
              </div>
              <div className="grid grid-cols-2 gap-8 px-4">
                {/* Pie Chart */}
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.top_categories}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ cursor: "pointer" }}
                        onClick={(data) => {
                          const cat = categories.find((c) => c.name === data.name);
                          if (cat) setSelectedCategoryId(cat.id);
                        }}
                      >
                        {stats.top_categories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatFullCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list - Clickable */}
                <div className="flex flex-col justify-center gap-3">
                  {stats.top_categories.map((cat, index) => {
                    const catData = categories.find((c) => c.name === cat.name);
                    return (
                      <div
                        key={cat.name}
                        onClick={() => catData && setSelectedCategoryId(catData.id)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-bg-input"
                      >
                        <div
                          className="w-3 h-3 rounded flex-shrink-0"
                          style={{ background: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1 text-sm text-text-primary">
                          {cat.name}
                        </div>
                        <div className="mono text-sm text-text-muted">
                          {formatCurrency(cat.total)}
                        </div>
                        <svg width="16" height="16" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Transaction Activity */}
          <div className="card p-5">
            <div className="text-sm text-text-muted mb-2">
              Transaction Activity
            </div>
            <div className="text-xl font-semibold text-text-primary">
              {stats?.transaction_count || 0} transactions
            </div>
            <div className="text-sm text-text-muted mt-1">
              in selected period
            </div>
          </div>
        </>
      )}

      {/* Loading overlay for category detail */}
      {loadingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="card p-8">
            <div className="loading">Loading category details...</div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          isOpen={!!editingTx}
          onClose={() => setEditingTx(null)}
          onSave={() => {
            if (onRefresh) onRefresh();
          }}
          categories={categories}
          subcategories={subcategories}
          apiBase={apiBase}
        />
      )}
    </div>
  );
}

export default Analytics;