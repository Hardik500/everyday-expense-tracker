import { useEffect, useState } from "react";
import type { Category, Subcategory, Transaction } from "../App";

type Props = {
  apiBase: string;
  categories: Category[];
  subcategories: Subcategory[];
  refreshKey: number;
  onUpdated: () => void;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function ReviewQueue({
  apiBase,
  categories,
  subcategories,
  refreshKey,
  onUpdated,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState<Record<number, string>>({});
  const [subcategory, setSubcategory] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetch(`${apiBase}/transactions?uncertain=true`)
      .then((res) => res.json())
      .then(setTransactions)
      .catch(() => setTransactions([]));
  }, [apiBase, refreshKey]);

  const submit = async (txId: number) => {
    setSaving((prev) => ({ ...prev, [txId]: true }));
    const payload = {
      category_id: category[txId] ? Number(category[txId]) : null,
      subcategory_id: subcategory[txId] ? Number(subcategory[txId]) : null,
      create_mapping: true,
    };
    await fetch(`${apiBase}/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving((prev) => ({ ...prev, [txId]: false }));
    onUpdated();
  };

  const skipTransaction = async (txId: number) => {
    setSaving((prev) => ({ ...prev, [txId]: true }));
    const miscCategory = categories.find((c) => c.name.toLowerCase() === "miscellaneous");
    await fetch(`${apiBase}/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: miscCategory?.id || null,
        subcategory_id: null,
        create_mapping: false,
      }),
    });
    setSaving((prev) => ({ ...prev, [txId]: false }));
    onUpdated();
  };

  const pagedTransactions = transactions.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(transactions.length / pageSize);

  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p style={{ marginTop: "1rem", fontWeight: 500, color: "var(--success)" }}>All caught up!</p>
          <p style={{ marginTop: "0.5rem" }}>No transactions need review right now</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Progress indicator */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--warning)",
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9375rem" }}>
                {transactions.length} transactions need review
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Assign categories to help track your spending
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Page {page + 1} of {totalPages}
          </div>
        </div>
      </div>

      {/* Transaction cards */}
      {pagedTransactions.map((tx, idx) => (
        <div
          key={tx.id}
          className="card animate-in"
          style={{
            animationDelay: `${idx * 50}ms`,
            padding: "1.25rem",
          }}
        >
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {/* Transaction info */}
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--bg-input)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--text-muted)",
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      fontSize: "0.9375rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={tx.description_raw}
                  >
                    {tx.description_raw}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    {formatDate(tx.posted_at)}
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div
                className="mono"
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: tx.amount < 0 ? "var(--danger)" : "var(--success)",
                }}
              >
                {tx.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(tx.amount))}
              </div>
            </div>

            {/* Category selectors */}
            <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 200 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                  Category
                </label>
                <select
                  value={category[tx.id] || ""}
                  onChange={(e) => setCategory((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                  style={{ width: "100%" }}
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                  Subcategory
                </label>
                <select
                  value={subcategory[tx.id] || ""}
                  onChange={(e) => setSubcategory((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                  disabled={!category[tx.id]}
                  style={{ width: "100%", opacity: category[tx.id] ? 1 : 0.5 }}
                >
                  <option value="">Select subcategory</option>
                  {subcategories
                    .filter((sub) => String(sub.category_id) === category[tx.id])
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                <button
                  className="ghost"
                  onClick={() => skipTransaction(tx.id)}
                  disabled={saving[tx.id]}
                  style={{ flex: 1 }}
                >
                  Skip
                </button>
                <button
                  className="primary"
                  onClick={() => submit(tx.id)}
                  disabled={!category[tx.id] || saving[tx.id]}
                  style={{ flex: 1 }}
                >
                  {saving[tx.id] ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button
            className="secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <button
            className="secondary"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default ReviewQueue;
