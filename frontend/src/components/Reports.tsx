import { useEffect, useState } from "react";

type Props = {
  apiBase: string;
  refreshKey: number;
};

type ReportItem = {
  category_id: number | null;
  category_name: string | null;
  total: number;
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

function Reports({ apiBase, refreshKey }: Props) {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/reports/summary`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, [apiBase, refreshKey]);

  // Net balance (can be negative)
  const netBalance = items.reduce((sum, item) => sum + item.total, 0);
  // Total spending (only negative items, shown as positive)
  const totalSpend = Math.abs(items.filter((i) => i.total < 0).reduce((sum, item) => sum + item.total, 0));
  // Total income (only positive items)
  const totalIncome = items.filter((i) => i.total > 0).reduce((sum, item) => sum + item.total, 0);
  const categorizedItems = items.filter((i) => i.category_name);
  const uncategorized = items.find((i) => !i.category_name);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <div className="loading" style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p style={{ marginTop: "1rem", fontWeight: 500 }}>No data yet</p>
          <p style={{ marginTop: "0.5rem" }}>Import a statement to see your spending breakdown</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {/* Net Balance */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: netBalance >= 0 ? "var(--accent-glow)" : "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: netBalance >= 0 ? "var(--accent)" : "#ef4444",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Net Balance</span>
          </div>
          <div className="mono" style={{ fontSize: "1.75rem", fontWeight: 600, color: netBalance >= 0 ? "var(--accent)" : "#ef4444" }}>
            {formatFullCurrency(netBalance)}
          </div>
        </div>

        {/* Total Spending */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Total Spent</span>
          </div>
          <div className="mono" style={{ fontSize: "1.75rem", fontWeight: 600, color: "#ef4444" }}>
            {formatCurrency(totalSpend)}
          </div>
        </div>

        {/* Total Income */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--accent-glow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Total Income</span>
          </div>
          <div className="mono" style={{ fontSize: "1.75rem", fontWeight: 600, color: "var(--accent)" }}>
            {formatCurrency(totalIncome)}
          </div>
        </div>

        {/* Categories */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(139, 92, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8b5cf6",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Categories</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {categorizedItems.length}
          </div>
        </div>

        {/* Uncategorized */}
        {uncategorized && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f59e0b",
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Uncategorized</span>
            </div>
            <div className="mono" style={{ fontSize: "1.75rem", fontWeight: 600, color: "var(--warning)" }}>
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
        <div style={{ marginBottom: "1.5rem" }}>
          {categorizedItems.length > 0 && (
            <div
              style={{
                display: "flex",
                height: 12,
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--bg-input)",
              }}
            >
              {categorizedItems.map((item, idx) => {
                const percentage = (Math.abs(item.total) / totalSpend) * 100;
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
          )}
        </div>

        {/* Category list */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {items.map((item, idx) => {
            const percentage = totalSpend > 0 ? (Math.abs(item.total) / totalSpend) * 100 : 0;
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
                  transition: "background var(--transition-fast)",
                }}
              >
                {/* Color dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: getColor(item.category_name),
                    flexShrink: 0,
                  }}
                />

                {/* Category name */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                    {item.category_name || "Uncategorized"}
                  </div>
                </div>

                {/* Percentage */}
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", width: 50, textAlign: "right" }}>
                  {percentage.toFixed(1)}%
                </div>

                {/* Amount */}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Reports;
