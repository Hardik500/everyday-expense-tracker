import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { PageLoading } from "./ui/Loading";
import type { Category } from "../types";

type InsightData = {
  current_month: {
    total_spent: number;
    transaction_count: number;
    daily_average: number;
    month_name: string;
  };
  previous_month: {
    total_spent: number;
    transaction_count: number;
    month_name: string;
  };
  comparison: {
    percent_change: number;
    amount_change: number;
    trend: "up" | "down" | "same";
    daily_avg_change: number;
  };
  top_categories: Array<{
    id: number;
    name: string;
    color?: string | null;
    icon?: string | null;
    total: number;
    transaction_count: number;
    previous_total: number;
    percent_change: number;
  }>;
  biggest_expenses: Array<{
    id: number;
    description: string;
    amount: number;
    posted_at: string;
    category_name?: string | null;
  }>;
};

type Props = {
  apiBase: string;
  categories: Category[];
  refreshKey?: number;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Popular Lucide icons mapping
const ICON_PATHS: Record<string, string> = {
  "shopping-bag": "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  "utensils": "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M3 2h6M3 2v20M12 2v10c0 4.4 3.6 8 8 8h4V2h-4c-4.4 0-8 3.6-8 8z",
  "car": "M14 16H9m10 0h3v-3.15a1 1 0 00-.8-.76l-2.1-.42a1 1 0 01-.93-.54L17.35 8H5.64l-.86 3.29a1 1 0 01-.93.54l-2.1.42a1 1 0 00-.8.76V16h3m12-4h-5M2 16h.01M2 12h.01M19 7a4 4 0 10-8 0 4 4 0 008 0z",
  "home": "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
  "zap": "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  "wifi": "M5 12.55a11 11 0 0114.08 0M4.26 10.03a15.5 15.5 0 0122.48 0M1.42 13.8a19.5 19.5 0 0133.16 0M12 18h.01",
  "smartphone": "M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01",
  "tv": "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM8 22v-4M16 22v-4M12 2v4",
  "heart": "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  "gift": "M20 12v10H4V12M2 7h20v5H2zM12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  "briefcase": "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 13v4",
  "plane": "M2 12h20M13 2v20M21 12a9 9 0 01-9 9M3 12a9 9 0 019-9",
  "book-open": "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  "gamepad-2": "M6 11h4M8 9v4M15 12h.01M18 10h.01M17.32 5H6.68a4 4 0 00-3.978 3.59c-.019.154-.03.31-.03.468v7.884c0 .157.011.314.03.468A4 4 0 006.68 21h10.64a4 4 0 003.978-3.59c.019-.154.03-.31.03-.468v-7.884c0-.157-.011-.314-.03-.468A4 4 0 0017.32 5z",
  "coffee": "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3",
  "music": "M9 18V5l12-2v13",
  "film": "M7 4v16M17 4v16M2 9h20M2 15h20M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z",
  "credit-card": "M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22",
  "banknote": "M4 10h3l4-5 4 5h7M4 14h16M1 4h22v16H1z",
  "trending-up": "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  "shield": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "pill": "M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM14.5 9l5.5 5.5",
  "dumbbell": "M6.5 6.5h11M6.5 17.5h11M6 20L2 16l4-4M18 20l4-4-4-4M12 5v14",
  "graduation-cap": "M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5",
  "shopping-cart": "M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6",
  "package": "M11 21.73a2 2 0 002 2l7.5-4.37a2 2 0 001-1.73V6.27a2 2 0 00-1-1.73L13 1a2 2 0 00-2 0l-7.5 4.37a2 2 0 00-1 1.73v9.63a2 2 0 001 1.73L3 18l6 3M8 6v14",
  "truck": "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM10 18a3 3 0 100-6 3 3 0 000 6zM20 18a3 3 0 100-6 3 3 0 000 6z",
  "building": "M3 21h18M5 21V7l8-4 8 4v14M8 21V10h2v11M14 21v-5h2v5",
  "leaf": "M11 20A7 7 0 019.1 6.36 15.6 15.6 0 0020 18 15.56 15.56 0 0011 20zM7 20a9.44 9.44 0 0011-11.74A9.47 9.47 0 007 20z",
  "sun": "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 6a6 6 0 100 12 6 6 0 000-12z",
};

function SpendingInsights({ apiBase, categories, refreshKey }: Props) {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(`${apiBase}/analytics/insights`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      const data = await res.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [apiBase, refreshKey]);

  if (loading) {
    return (
      <div className="card" style={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
        <PageLoading text="Loading insights..." />
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="card" style={{ padding: "1.5rem" }}>
        <div style={{ color: "var(--danger)", textAlign: "center" }}>
          {error || "Unable to load insights"}
        </div>
      </div>
    );
  }

  const { current_month, previous_month, comparison, top_categories } = insights;
  const currentTotal = current_month.total_spent || 0;

  // Calculate budget utilization for top categories
  const topCatsWithBudget = top_categories.map((cat) => {
    const category = categories.find((c) => c.id === cat.id);
    const budget = category?.monthly_budget;
    const percentUsed = budget && budget > 0 ? (cat.total / budget) * 100 : null;
    return { ...cat, budget, percentUsed };
  });

  const getIconPath = (iconName?: string | null) => {
    if (!iconName) return null;
    return ICON_PATHS[iconName] || null;
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Month Comparison Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Current Month Card */}
        <div
          className="card"
          style={{
            padding: "1.25rem",
            background:
              "linear-gradient(135deg, var(--accent) 0%, var(--accent-light, var(--accent)) 100%)",
            color: "#fff",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20%",
              right: "-10%",
              width: "150px",
              height: "150px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "50%",
            }}
          />
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", opacity: 0.9 }}>
            {current_month.month_name}
          </h3>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            {formatCurrency(currentTotal)}
          </div>
          <div style={{ fontSize: "0.8125rem", opacity: 0.8 }}>
            {current_month.transaction_count} transactions • ₹{current_month.daily_average.toFixed(0)} avg/day
          </div>
        </div>

        {/* Comparison Card */}
        <div
          className="card"
          style={{
            padding: "1.25rem",
            border:
              comparison.trend === "up"
                ? "2px solid var(--danger)"
                : comparison.trend === "down"
                  ? "2px solid var(--success)"
                  : "2px solid var(--border-color)",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            Since {previous_month.month_name}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.5rem",
            }}
          >
            {comparison.trend !== "same" && (
              <svg
                width="24"
                height="24"
                fill="none"
                stroke={comparison.trend === "up" ? "var(--danger)" : "var(--success)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                style={{
                  transform:
                    comparison.trend === "down" ? "rotate(180deg)" : "none",
                }}
              >
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            )}
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color:
                  comparison.trend === "up"
                    ? "var(--danger)"
                    : comparison.trend === "down"
                      ? "var(--success)"
                      : "var(--text-primary)",
              }}
            >
              {comparison.percent_change > 0 ? "+" : ""}
              {comparison.percent_change.toFixed(1)}%
            </div>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {comparison.percent_change > 0 ? "📈" : comparison.percent_change < 0 ? "📉" : "➡️"} {" "}
            {formatCurrency(Math.abs(comparison.amount_change))}{" "}
            {comparison.percent_change > 0 ? "more" : comparison.percent_change < 0 ? "less" : "same as"} last month
          </div>
        </div>
      </div>

      {/* Top Categories */}
      {topCatsWithBudget.length > 0 && (
        <div className="card" style={{ padding: "1.25rem", overflow: "hidden" }}>
          <h3
            style={{
              margin: "0 0 1rem 0",
              fontSize: "0.875rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Top Spending Categories
          </h3>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {topCatsWithBudget.map((cat) => {
              const iconPath = getIconPath(cat.icon);
              return (
                <div
                  key={cat.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.75rem",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {/* Icon or Color Dot */}
                  {iconPath ? (
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke={cat.color || "var(--text-primary)"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d={iconPath} />
                    </svg>
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: cat.color || "var(--accent)",
                      }}
                    />
                  )}

                  {/* Category Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {cat.name}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {formatCurrency(cat.total)}
                      </span>
                    </div>

                    {/* Progress bar with budget */}
                    {cat.budget && cat.budget > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "var(--border-subtle)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(cat.percentUsed || 0, 100)}%`,
                              height: "100%",
                              background:
                                (cat.percentUsed || 0) > 100
                                  ? "var(--danger)"
                                  : (cat.percentUsed || 0) > 80
                                    ? "var(--warning)"
                                    : cat.color || "var(--accent)",
                              borderRadius: 3,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color:
                              (cat.percentUsed || 0) > 100
                                ? "var(--danger)"
                                : "var(--text-muted)",
                          }}
                        >
                          {cat.percentUsed?.toFixed(0)}%
                        </span>
                      </div>
                    )}

                    {/* Trend indicator */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      {cat.percent_change !== 0 && (
                        <>
                          <svg
                            width="12"
                            height="12"
                            fill="none"
                            stroke={
                              cat.percent_change > 0 ? "var(--danger)" : "var(--success)"
                            }
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            style={{
                              transform:
                                cat.percent_change < 0 ? "rotate(180deg)" : "none",
                            }}
                          >
                            <path d="M7 17L17 7M17 7H7M17 7V17" />
                          </svg>
                          <span
                            style={{
                              color:
                                cat.percent_change > 0
                                  ? "var(--danger)"
                                  : "var(--success)",
                            }}
                          >
                            {cat.percent_change > 0 ? "+" : ""}
                            {cat.percent_change}%
                          </span>
                        </>
                      )}
                      <span style={{ color: "var(--text-muted)" }}>
                        {cat.transaction_count} transactions
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          className="card"
          style={{ padding: "1rem", textAlign: "center", background: "var(--bg-secondary)" }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Daily Average
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            ₹{current_month.daily_average.toFixed(0)}
          </div>
          {comparison.daily_avg_change !== 0 && (
            <div
              style={{
                fontSize: "0.6875rem",
                color: comparison.daily_avg_change > 0 ? "var(--danger)" : "var(--success)",
                marginTop: "0.25rem",
              }}
            >
              {comparison.daily_avg_change > 0 ? "↑" : "↓"} ₹
              {Math.abs(comparison.daily_avg_change).toFixed(0)}
            </div>
          )}
        </div>

        <div
          className="card"
          style={{ padding: "1rem", textAlign: "center", background: "var(--bg-secondary)" }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Transactions
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {current_month.transaction_count}
          </div>
          {previous_month.transaction_count > 0 && (
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
                marginTop: "0.25rem",
              }}
            >
              vs {previous_month.transaction_count} last month
            </div>
          )}
        </div>

        <div
          className="card"
          style={{ padding: "1rem", textAlign: "center", background: "var(--bg-secondary)" }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Active Categories
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {top_categories.length}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            with spending
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpendingInsights;
