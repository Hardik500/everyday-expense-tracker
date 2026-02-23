import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";
import TransferDetector from "../transactions/TransferDetector";
import Select from "../ui/Select";
import { CSVExportButton } from "./CSVExport";
import { ReportPDFExport } from "./PDFExport";

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

type Transaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_name: string | null;
  category_id: number | null;
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

function Reports({ apiBase, refreshKey, onRefresh, onCategorySelect }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReportItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // "" = all time, "YYYY-MM" = specific month

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

  useEffect(() => {
    if (items.length === 0) {
      setLoading(true);
    }
    let summaryUrl = `${apiBase}/reports/summary`;
    let transactionsUrl = `${apiBase}/transactions`;

    if (selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      const dateParams = `?start_date=${startDate}&end_date=${endDate}`;
      summaryUrl += dateParams;
      transactionsUrl += dateParams;
    }

    // Fetch both summary and transactions
    Promise.all([
      fetchWithAuth(summaryUrl),
      fetchWithAuth(transactionsUrl)
    ])
      .then(([summaryRes, transactionsRes]) => Promise.all([
        summaryRes.json(),
        transactionsRes.json()
      ]))
      .then(([summaryData, transactionsData]) => {
        setItems(summaryData.items || []);
        setTransactions(transactionsData.transactions || transactionsData || []);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setTransactions([]);
        setLoading(false);
      });
  }, [apiBase, refreshKey, selectedMonth]);

  // Categories that represent asset movements (not true spending/income)
  const assetMovementCategories = ["Transfers", "Investments"];

  // Separate items into spending, asset movements, and income
  const spendingItems = items.filter(
    (i) => i.total < 0 && !assetMovementCategories.includes(i.category_name || "")
  );
  const assetItems = items.filter((i) => assetMovementCategories.includes(i.category_name || ""));
  const incomeItems = items.filter(
    (i) => i.total > 0 && !assetMovementCategories.includes(i.category_name || "")
  );

  // True spending (excludes investments and transfers)
  const totalSpend = Math.abs(spendingItems.reduce((sum, item) => sum + item.total, 0));

  // True income (excludes investment returns and transfer receipts)
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.total, 0);

  // Cash Flow = true change in account (all income minus all outflows)
  const cashFlow = items.reduce((sum, item) => sum + item.total, 0);

  // Savings Rate = percentage of income not spent on expenses
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpend) / totalIncome) * 100 : 0;

  // Total invested/transferred
  const totalInvested = Math.abs(
    assetItems.filter(i => i.total < 0).reduce((sum, item) => sum + item.total, 0)
  );

  // const categorizedSpending was = spendingItems.filter((i) => i.category_name);
  const uncategorized = items.find((i) => !i.category_name);

  if (loading) {
    return (
      <div className="card text-center p-12">
        <div className="loading text-2xl text-text-muted">
          Loading...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid gap-6">
        {/* Month Selector - Always visible */}
        <div className="flex items-center gap-4">
          <Select
            label="Period"
            value={selectedMonth || ""}
            onChange={(val) => setSelectedMonth(String(val))}
            options={[
              { value: "", label: "All Time" },
              ...getMonthOptions()
            ]}
            className="min-w-[200px]"
          />
        </div>

        <div className="p-16 text-center bg-bg-card rounded-xl border border-dashed border-border-color">
          <div className="w-16 h-16 bg-accent-glow rounded-full flex items-center justify-center mx-auto mb-6 text-accent">
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h2 className="text-2xl mb-2 text-text-primary">
            {selectedMonth ? "No transactions in this period" : "Welcome to Expense Tracker!"}
          </h2>
          <p className="text-text-secondary mb-8 max-w-[400px] mx-auto leading-normal">
            {selectedMonth
              ? "Try selecting a different month from the dropdown above, or view All Time to see your complete transaction history."
              : "It looks like you haven't imported any transactions yet. Start by uploading a bank statement to see your financial analytics."
            }
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

  return (
    <div className="grid gap-6">
      {/* Month Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select
          label="Period"
          value={selectedMonth || ""}
          onChange={(val) => setSelectedMonth(String(val))}
          options={[
            { value: "", label: "All Time" },
            ...getMonthOptions()
          ]}
          className="min-w-[200px]"
        />

        {/* Feature 14: PDF Export */}
        <div className="flex gap-2">
          <ReportPDFExport
            month={selectedMonth || "All Time"}
            totalSpent={totalSpend}
            totalIncome={totalIncome}
            categories={spendingItems.slice(0, 10).map(item => ({
              name: item.category_name || "Uncategorized",
              amount: Math.abs(item.total),
              color: getColor(item.category_name)
            }))}
            reportData={transactions}
          />
          <CSVExportButton
            data={transactions}
            filename={`expense-report-${selectedMonth || "all-time"}`}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {/* Cash Flow (true account change) */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center"
              style={{
                background: cashFlow >= 0 ? "var(--accent-glow)" : "rgba(239, 68, 68, 0.15)",
                color: cashFlow >= 0 ? "var(--accent)" : "#ef4444",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-text-muted">Cash Flow</span>
          </div>
          <div className={`mono text-3xl font-semibold ${cashFlow >= 0 ? "text-accent" : "text-danger"}`}>
            {formatFullCurrency(cashFlow)}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {cashFlow < 0 ? "Used savings for investments" : "Added to savings"}
          </div>
        </div>

        {/* Savings Rate */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-emerald-500/15 text-emerald-500">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-text-muted">Savings Rate</span>
          </div>
          <div className="mono text-3xl font-semibold text-emerald-500">
            {savingsRate.toFixed(0)}%
          </div>
          <div className="text-xs text-text-muted mt-1">
            Income not spent on expenses
          </div>
        </div>

        {/* Total Spending */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-red-500/15 text-red-500">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-sm text-text-muted">Total Spent</span>
          </div>
          <div className="mono text-3xl font-semibold text-red-500">
            {formatCurrency(totalSpend)}
          </div>
        </div>

        {/* Total Income */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-accent-glow text-accent">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm text-text-muted">Total Income</span>
          </div>
          <div className="mono text-3xl font-semibold text-accent">
            {formatCurrency(totalIncome)}
          </div>
        </div>

        {/* Investments */}
        {totalInvested > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-purple-500/15 text-purple-500">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-sm text-text-muted">Invested</span>
            </div>
            <div className="mono text-3xl font-semibold text-purple-500">
              {formatCurrency(totalInvested)}
            </div>
          </div>
        )}

        {/* Uncategorized */}
        {uncategorized && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-amber-500/15 text-amber-500">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-text-muted">Uncategorized</span>
            </div>
            <div className="mono text-3xl font-semibold text-warning">
              {formatCurrency(Math.abs(uncategorized.total))}
            </div>
          </div>
        )}
      </div>

      {/* Spending Breakdown */}
      <div className="card">
        <div className="card-header">
          <h2>Spending by Category</h2>
        </div>

        {/* Visual bar chart */}
        <div className="mb-6">
          {spendingItems.length > 0 && (
            <div className="flex h-3 rounded-full overflow-hidden bg-bg-input">
              {spendingItems.map((item, idx) => {
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
          )}
        </div>

        {/* Category list - only true spending (excludes transfers and investments) */}
        <div className="grid gap-3">
          {spendingItems.map((item, idx) => {
            const percentage = totalSpend > 0 ? (Math.abs(item.total) / totalSpend) * 100 : 0;
            const isClickable = item.category_id && onCategorySelect;
            return (
              <div
                key={idx}
                onClick={() => isClickable && onCategorySelect(item.category_id!)}
                className={`flex items-center gap-4 px-4 py-3.5 bg-bg-input rounded-lg transition-all ${isClickable ? "cursor-pointer hover:bg-bg-hover" : ""}`}
              >
                {/* Color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: getColor(item.category_name) }}
                />

                {/* Category name */}
                <div className="flex-1">
                  <div className="font-medium text-text-primary text-sm">
                    {item.category_name || "Uncategorized"}
                  </div>
                </div>

                {/* Percentage */}
                <div className="text-sm text-text-muted w-[50px] text-right">
                  {percentage.toFixed(1)}%
                </div>

                {/* Amount */}
                <div className="mono font-medium text-text-primary w-[100px] text-right text-sm">
                  {formatCurrency(Math.abs(item.total))}
                </div>

                {/* Arrow icon for clickable items */}
                {isClickable && (
                  <svg width="16" height="16" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Income Breakdown */}
      {incomeItems.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Income Sources</h2>
          </div>
          <div className="grid gap-3">
            {incomeItems.map((item, idx) => {
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
                  <div className="mono font-medium text-accent w-[100px] text-right text-sm">
                    {formatCurrency(item.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset Movements (Investments & Transfers - not counted as spending) */}
      {assetItems.length > 0 && (
        <div className="card opacity-85">
          <div className="card-header">
            <h2>Asset Movements</h2>
            <span className="text-xs text-text-muted">
              Investments & transfers (not counted in spending)
            </span>
          </div>
          <div className="grid gap-3">
            {assetItems.map((item, idx) => (
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

export default Reports;