import { useEffect, useState } from "react";
import type { Category, Subcategory, Transaction } from "../App";

type Props = {
  apiBase: string;
  categories: Category[];
  subcategories: Subcategory[];
  refreshKey: number;
  onUpdated?: () => void;
};

type SimilarTransaction = {
  id: number;
  description_norm: string;
  amount: number;
  posted_at: string;
  category_id: number | null;
  subcategory_id: number | null;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

function Transactions({ apiBase, categories, subcategories, refreshKey, onUpdated }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Edit modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [similarTxs, setSimilarTxs] = useState<SimilarTransaction[]>([]);
  const [similarPattern, setSimilarPattern] = useState("");
  const [selectedSimilarIds, setSelectedSimilarIds] = useState<Set<number>>(new Set());
  const [createRule, setCreateRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter) {
      params.append("category_id", categoryFilter);
    }
    fetch(`${apiBase}/transactions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data);
        setLoading(false);
        setPage(0);
      })
      .catch(() => {
        setTransactions([]);
        setLoading(false);
      });
  }, [apiBase, categoryFilter, refreshKey]);

  // Reset page when search query changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const filteredTransactions = searchQuery
    ? transactions.filter((tx) =>
        tx.description_raw.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions;

  const pagedTransactions = filteredTransactions.slice(
    page * pageSize,
    (page + 1) * pageSize
  );
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Open edit modal
  const openEdit = async (tx: Transaction) => {
    setEditingTx(tx);
    setSelectedCategory(tx.category_id || null);
    setSelectedSubcategory(tx.subcategory_id || null);
    setCreateRule(false);
    setRuleName("");
    setSelectedSimilarIds(new Set([tx.id]));
    
    // Fetch similar transactions
    setLoadingSimilar(true);
    try {
      const res = await fetch(`${apiBase}/transactions/${tx.id}/similar`);
      const data = await res.json();
      setSimilarTxs(data.similar || []);
      setSimilarPattern(data.pattern || "");
      // Pre-select all similar with same or no category
      const preselected = new Set(
        data.similar
          .filter((s: SimilarTransaction) => !s.category_id || s.category_id === tx.category_id)
          .map((s: SimilarTransaction) => s.id)
      );
      setSelectedSimilarIds(preselected);
    } catch {
      setSimilarTxs([]);
      setSimilarPattern("");
    }
    setLoadingSimilar(false);
  };

  // Close modal
  const closeEdit = () => {
    setEditingTx(null);
    setSimilarTxs([]);
    setSelectedSimilarIds(new Set());
  };

  // Save changes
  const saveChanges = async () => {
    if (!editingTx || !selectedCategory) return;
    
    setSaving(true);
    try {
      const txIds = Array.from(selectedSimilarIds);
      
      const formData = new FormData();
      txIds.forEach((id) => formData.append("transaction_ids", id.toString()));
      formData.append("category_id", selectedCategory.toString());
      if (selectedSubcategory) {
        formData.append("subcategory_id", selectedSubcategory.toString());
      }
      if (createRule && similarPattern) {
        formData.append("create_rule", "true");
        formData.append("rule_pattern", similarPattern.toUpperCase());
        formData.append("rule_name", ruleName || `User: ${similarPattern}`);
      }
      
      const res = await fetch(`${apiBase}/transactions/bulk-update`, {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        closeEdit();
        onUpdated?.();
        // Refresh transactions
        const params = new URLSearchParams();
        if (categoryFilter) params.append("category_id", categoryFilter);
        const txRes = await fetch(`${apiBase}/transactions?${params.toString()}`);
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (err) {
      console.error("Failed to save:", err);
    }
    setSaving(false);
  };

  const availableSubcategories = subcategories.filter(
    (s) => s.category_id === selectedCategory
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Filters */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ flex: "1 1 300px", position: "relative" }}>
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              style={{ paddingLeft: 40, paddingRight: searchQuery ? 36 : 12, width: "100%" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category filter */}
          <div style={{ flex: "0 0 200px" }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div style={{ flex: "0 0 auto", textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {searchQuery ? (
                <span>
                  <strong>{filteredTransactions.length}</strong> of {transactions.length} transactions
                </span>
              ) : (
                `${filteredTransactions.length} transactions`
              )}
            </div>
            <div
              className="mono"
              style={{
                fontWeight: 600,
                fontSize: "0.9375rem",
                color: totalAmount >= 0 ? "var(--success)" : "var(--text-primary)",
              }}
            >
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div className="loading" style={{ color: "var(--text-muted)" }}>
              Loading transactions...
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p style={{ marginTop: "1rem", fontWeight: 500 }}>No transactions found</p>
            <p style={{ marginTop: "0.5rem" }}>
              {searchQuery ? "Try a different search term" : "Import a statement to get started"}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Date</th>
                    <th>Description</th>
                    <th style={{ width: 140 }}>Category</th>
                    <th style={{ width: 120, textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTransactions.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      className="animate-in"
                      style={{ 
                        animationDelay: `${idx * 20}ms`,
                        cursor: "pointer",
                      }}
                      onClick={() => openEdit(tx)}
                      title="Click to edit"
                    >
                      <td>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                          {formatDate(tx.posted_at)}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(tx.posted_at).getFullYear()}
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            maxWidth: 400,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={tx.description_raw}
                        >
                          {tx.description_raw}
                        </div>
                      </td>
                      <td>
                        {tx.category_id ? (
                          <span
                            className="badge"
                            style={{
                              background: tx.is_uncertain
                                ? "rgba(245, 158, 11, 0.15)"
                                : "var(--accent-glow)",
                              color: tx.is_uncertain ? "var(--warning)" : "var(--accent)",
                            }}
                          >
                            {categories.find((c) => c.id === tx.category_id)?.name || "Unknown"}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 500,
                            color: tx.amount < 0 ? "var(--danger)" : "var(--success)",
                          }}
                        >
                          {tx.amount < 0 ? "-" : "+"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem 1.25rem",
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Showing {page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, filteredTransactions.length)} of{" "}
                  {filteredTransactions.length}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="secondary"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    style={{ padding: "0.5rem 1rem" }}
                  >
                    Previous
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    style={{ padding: "0.5rem 1rem" }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingTx && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflow: "auto",
              animation: "slideUp 0.2s ease",
            }}
          >
            <div className="card-header" style={{ marginBottom: "1rem" }}>
              <h2>Edit Transaction</h2>
              <button
                onClick={closeEdit}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "0.5rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Transaction Details */}
            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>
                {editingTx.description_raw}
              </div>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                <span>{new Date(editingTx.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                <span className="mono" style={{ color: editingTx.amount < 0 ? "var(--danger)" : "var(--success)" }}>
                  {editingTx.amount < 0 ? "-" : "+"}{formatCurrency(editingTx.amount)}
                </span>
              </div>
            </div>

            {/* Category Selection */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Category
                </label>
                <select
                  value={selectedCategory || ""}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value ? Number(e.target.value) : null);
                    setSelectedSubcategory(null);
                  }}
                  style={{ width: "100%" }}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Subcategory
                </label>
                <select
                  value={selectedSubcategory || ""}
                  onChange={(e) => setSelectedSubcategory(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: "100%" }}
                  disabled={!selectedCategory}
                >
                  <option value="">Select subcategory</option>
                  {availableSubcategories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Similar Transactions */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Similar Transactions ({similarTxs.length} found)
                </label>
                {similarTxs.length > 1 && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="secondary"
                      style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
                      onClick={() => setSelectedSimilarIds(new Set(similarTxs.map((t) => t.id)))}
                    >
                      Select All
                    </button>
                    <button
                      className="secondary"
                      style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
                      onClick={() => setSelectedSimilarIds(new Set([editingTx.id]))}
                    >
                      Select None
                    </button>
                  </div>
                )}
              </div>
              
              {loadingSimilar ? (
                <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
                  Finding similar transactions...
                </div>
              ) : similarTxs.length > 0 ? (
                <div style={{ maxHeight: 250, overflow: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
                  {similarTxs.map((tx) => (
                    <label
                      key={tx.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto auto",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem 1rem",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border-color)",
                        background: selectedSimilarIds.has(tx.id) ? "var(--accent-glow)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSimilarIds.has(tx.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedSimilarIds);
                          if (e.target.checked) {
                            newSet.add(tx.id);
                          } else if (tx.id !== editingTx.id) {
                            newSet.delete(tx.id);
                          }
                          setSelectedSimilarIds(newSet);
                        }}
                        disabled={tx.id === editingTx.id}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div style={{ 
                          fontSize: "0.8125rem", 
                          color: "var(--text-primary)",
                          overflow: "hidden", 
                          textOverflow: "ellipsis", 
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}>
                          {tx.description_norm}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          {new Date(tx.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <div 
                        className="mono" 
                        style={{ 
                          fontSize: "0.8125rem", 
                          color: tx.amount < 0 ? "var(--danger)" : "var(--success)",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tx.amount < 0 ? "-" : "+"}{formatCurrency(tx.amount)}
                      </div>
                      {tx.category_id ? (
                        <span className="badge" style={{ fontSize: "0.6875rem", whiteSpace: "nowrap" }}>
                          {categories.find((c) => c.id === tx.category_id)?.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>—</span>
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  No similar transactions found
                </div>
              )}
              
              <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {selectedSimilarIds.size} transaction{selectedSimilarIds.size !== 1 ? "s" : ""} will be updated
              </div>
            </div>

            {/* Create Rule Option */}
            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={createRule}
                  onChange={(e) => setCreateRule(e.target.checked)}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>Create rule for future transactions</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Pattern: <code style={{ background: "var(--bg-secondary)", padding: "0.125rem 0.375rem", borderRadius: 4 }}>{similarPattern.toUpperCase()}</code>
                  </div>
                </div>
              </label>
              
              {createRule && (
                <div style={{ marginTop: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="Rule name (optional)"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
              <button onClick={saveChanges} disabled={!selectedCategory || saving}>
                {saving ? "Saving..." : `Update ${selectedSimilarIds.size} Transaction${selectedSimilarIds.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default Transactions;
