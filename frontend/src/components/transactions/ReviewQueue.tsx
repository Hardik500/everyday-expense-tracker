import { useEffect, useState, useMemo } from "react";
import { fetchWithAuth } from "../../utils/api";
import type { Category, Subcategory, Transaction } from "../../App";
import AISuggestions from "./AISuggestions";
import SubcategorySearch from "../categories/SubcategorySearch";
import { useToast } from "../common/Toast";

type Props = {
  apiBase: string;
  categories: Category[];
  subcategories: Subcategory[];
  refreshKey: number;
  onUpdated: () => void;
};

type SimilarInfo = {
  count: number;
  pattern: string;
  ids: number[];
};

type AIStatus = {
  configured: boolean;
  model: string | null;
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

  const pagedTransactions = useMemo(() =>
    transactions.slice(page * pageSize, (page + 1) * pageSize),
    [transactions, page]
  );
  const totalPages = Math.ceil(transactions.length / pageSize);

  // Similar transactions tracking
  const [similarInfo, setSimilarInfo] = useState<Record<number, SimilarInfo>>({});
  const [applyToSimilar, setApplyToSimilar] = useState<Record<number, boolean>>({});
  const [createRule, setCreateRule] = useState<Record<number, boolean>>({});
  const [editedPattern, setEditedPattern] = useState<Record<number, string>>({});

  // AI categorization
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ processed: number; total: number } | null>(null);
  const [aiProcessingTx, setAiProcessingTx] = useState<Record<number, boolean>>({});

  // Check AI status on mount
  useEffect(() => {
    fetchWithAuth(`${apiBase}/ai/status`)
      .then((res) => res.json())
      .then(setAiStatus)
      .catch(() => setAiStatus({ configured: false, model: null }));
  }, [apiBase]);

  useEffect(() => {
    fetchWithAuth(`${apiBase}/transactions?uncertain=true`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data);
      })
      .catch(() => setTransactions([]));
  }, [apiBase, refreshKey]);

  // Fetch similar transactions only for visible items
  useEffect(() => {
    pagedTransactions.forEach((tx: Transaction) => {
      if (!similarInfo[tx.id]) {
        fetchSimilar(tx.id);
      }
    });
  }, [pagedTransactions]); // Now depends on memoized array

  const fetchSimilar = async (txId: number) => {
    try {
      const res = await fetchWithAuth(`${apiBase}/transactions/${txId}/similar`);
      const data = await res.json();
      setSimilarInfo((prev) => ({
        ...prev,
        [txId]: {
          count: data.count || 0,
          pattern: data.pattern || "",
          ids: (data.similar || []).map((s: { id: number }) => s.id),
        },
      }));
      // Default to applying to similar if there are any
      if (data.count > 1) {
        setApplyToSimilar((prev) => ({ ...prev, [txId]: true }));
      }
    } catch {
      setSimilarInfo((prev) => ({ ...prev, [txId]: { count: 0, pattern: "", ids: [] } }));
    }
  };

  const submit = async (txId: number) => {
    setSaving((prev) => ({ ...prev, [txId]: true }));

    const catId = category[txId] ? Number(category[txId]) : null;
    const subId = subcategory[txId] ? Number(subcategory[txId]) : null;
    const similar = similarInfo[txId];
    const shouldApplyToSimilar = applyToSimilar[txId] && similar && similar.count > 1;
    const shouldCreateRule = createRule[txId] && similar && similar.pattern;

    if (shouldApplyToSimilar && catId) {
      // Use bulk update API
      const formData = new FormData();
      similar.ids.forEach((id) => formData.append("transaction_ids", id.toString()));
      formData.append("category_id", catId.toString());
      if (subId) {
        formData.append("subcategory_id", subId.toString());
      }
      if (shouldCreateRule) {
        const patternToUse = editedPattern[txId] || similar.pattern;
        formData.append("create_rule", "true");
        formData.append("rule_pattern", patternToUse.toUpperCase());
        formData.append("rule_name", `Review: ${patternToUse}`);
      }

      await fetchWithAuth(`${apiBase}/transactions/bulk-update`, {
        method: "POST",
        body: formData,
      });

      // Optimistic update: remove ALL items affected by bulk update
      if (shouldApplyToSimilar) {
        setTransactions(prev => prev.filter(t => !similar.ids.includes(t.id)));
      }
    } else {
      // Single transaction update
      const payload = {
        category_id: catId,
        subcategory_id: subId,
        create_mapping: true,
      };
      await fetchWithAuth(`${apiBase}/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Optimistic update: remove single item
      setTransactions(prev => prev.filter(t => t.id !== txId));
    }

    setSaving((prev) => ({ ...prev, [txId]: false }));
    onUpdated();
  };

  const skipTransaction = async (txId: number) => {
    if (!categories || !Array.isArray(categories)) {
      console.error("Categories not available");
      return;
    }
    setSaving((prev) => ({ ...prev, [txId]: true }));
    const miscCategory = categories.find((c) => c.name.toLowerCase() === "miscellaneous");
    await fetchWithAuth(`${apiBase}/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: miscCategory?.id || null,
        subcategory_id: null,
        create_mapping: false,
      }),
    });
    // Optimistic update
    setTransactions(prev => prev.filter(t => t.id !== txId));
    setSaving((prev) => ({ ...prev, [txId]: false }));
    onUpdated();
  };

  // AI categorize all uncategorized transactions
  const aiCategorizeAll = async () => {
    if (!aiStatus?.configured) return;

    setAiLoading(true);
    setAiProgress({ processed: 0, total: 0 }); // Will be updated by start event

    try {
      const formData = new FormData();
      // With streaming, we can safely process more transactions in one go
      // Increasing limit to 50 to cover more of the queue while keeping feedback immediate
      formData.append("limit", Math.min(transactions.length, 50).toString());
      formData.append("dry_run", "false");

      const response = await fetchWithAuth(`${apiBase}/ai/categorize`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Batch categorization failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);

            if (event.type === "start") {
              setAiProgress({ processed: 0, total: event.total });
            } else if (event.type === "progress") {
              setAiProgress((prev) => ({
                processed: event.categorized,
                total: prev?.total || event.current
              }));
            } else if (event.type === "complete") {
              const stats = event.stats;
              // Show toast with results
              if (stats.categorized > 0) {
                addToast({
                  type: "success",
                  title: `Categorized ${stats.categorized} transactions`,
                  message: stats.rules_created > 0
                    ? `Created ${stats.rules_created} new rules`
                    : undefined,
                  duration: 5000,
                });
              } else {
                addToast({
                  type: "info",
                  title: "No transactions categorized",
                  message: "AI couldn't determine categories",
                  duration: 4000,
                });
              }

              // Refresh after brief delay
              setTimeout(() => {
                setAiProgress(null);
                onUpdated();
              }, 1000);
            }
          } catch (e) {
            console.error("Error parsing stream:", e);
          }
        }
      }

    } catch (err) {
      console.error("AI categorization failed:", err);
      addToast({
        type: "error",
        title: "Batch categorization failed",
        message: "Please try again later",
        duration: 4000,
      });
      setAiLoading(false);
    }
  };

  // Toast notifications
  const { toasts, addToast, dismissToast, ToastContainer } = useToast();

  // AI categorize single transaction
  const aiCategorizeSingle = async (txId: number) => {
    if (!aiStatus?.configured) return;

    setAiProcessingTx((prev) => ({ ...prev, [txId]: true }));

    try {
      const res = await fetchWithAuth(`${apiBase}/ai/categorize/${txId}`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();

        if (data.status === "ok") {
          const similarCount = data.similar_updated || 0;
          addToast({
            type: "success",
            title: `Categorized as ${data.category}`,
            message: similarCount > 0
              ? `Also updated ${similarCount} similar transaction${similarCount > 1 ? "s" : ""}`
              : `Subcategory: ${data.subcategory}`,
            duration: 4000,
          });
        } else if (data.status === "suggestion_created") {
          addToast({
            type: "info",
            title: "New category suggested",
            message: `AI suggests: ${data.suggested_category} → ${data.suggested_subcategory}`,
            duration: 5000,
          });
        } else {
          addToast({
            type: "warning",
            title: "Could not categorize",
            message: data.message || "AI couldn't determine the category",
            duration: 4000,
          });
        }

        onUpdated();
      } else {
        addToast({
          type: "error",
          title: "Categorization failed",
          message: "Please try again",
          duration: 4000,
        });
      }
    } catch (err) {
      console.error("AI categorization failed:", err);
      addToast({
        type: "error",
        title: "Network error",
        message: "Could not reach the AI service",
        duration: 4000,
      });
    } finally {
      setAiProcessingTx((prev) => ({ ...prev, [txId]: false }));
    }
  };



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
      {/* AI Category Suggestions */}
      <AISuggestions apiBase={apiBase} refreshKey={refreshKey} onUpdated={onUpdated} />

      {/* Progress indicator */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* AI Categorize Button */}
            {aiStatus?.configured && (
              <button
                onClick={aiCategorizeAll}
                disabled={aiLoading}
                className="primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                {aiLoading ? (
                  aiProgress ? `Processing ${aiProgress.processed}/${aiProgress.total}...` : "Starting..."
                ) : (
                  `AI Categorize All`
                )}
              </button>
            )}
            {!aiStatus?.configured && aiStatus !== null && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.5rem 0.75rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
                💡 Set GEMINI_API_KEY to enable AI
              </div>
            )}
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Page {page + 1} of {totalPages}
            </div>
          </div>
        </div>

        {/* AI Progress Bar */}
        {aiProgress && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
              <span>AI categorizing transactions...</span>
              <span>{aiProgress.processed} of {aiProgress.total} categorized</span>
            </div>
            <div style={{ height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(aiProgress.processed / Math.max(aiProgress.total, 1)) * 100}%`,
                  background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction cards */}
      {(pagedTransactions || []).map((tx) => {
        const similar = similarInfo[tx.id];
        const hasSimilar = similar && similar.count > 1;
        const willApplyToSimilar = applyToSimilar[tx.id] && hasSimilar;
        const isLoadingSimilar = !similar && !similarInfo[tx.id];

        return (
          <div
            key={tx.id}
            className="card card-stable"
            style={{
              opacity: 1,
              transition: 'opacity 150ms ease, transform 150ms ease',
              willChange: 'transform',
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

                {/* Similar transactions info */}
                {isLoadingSimilar ? (
                  <div
                    className="similar-skeleton"
                    style={{
                      marginTop: "1rem",
                      height: 80,
                      borderRadius: "var(--radius-md)",
                    }}
                  />
                ) : hasSimilar ? (
                  <div
                    className="similar-content"
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      background: "var(--bg-input)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {/* Apply to similar toggle */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                      }}
                    >
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                        Apply to {similar.count} similar transactions
                      </span>
                      <button
                        type="button"
                        onClick={() => setApplyToSimilar((prev) => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                        style={{
                          position: "relative",
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          border: "none",
                          background: applyToSimilar[tx.id] ? "var(--accent)" : "var(--bg-secondary)",
                          cursor: "pointer",
                          transition: "background 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: applyToSimilar[tx.id] ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "white",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>

                    {/* Pattern - editable */}
                    <div style={{ marginTop: "0.75rem" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                        Pattern (editable)
                      </label>
                      <input
                        type="text"
                        value={editedPattern[tx.id] ?? similar.pattern}
                        onChange={(e) => setEditedPattern((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-secondary)",
                          color: "var(--text-primary)",
                          fontSize: "0.8125rem",
                          fontFamily: "monospace",
                        }}
                        placeholder="Enter pattern..."
                      />
                    </div>

                    {/* Create rule toggle */}
                    {willApplyToSimilar && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          marginTop: "0.75rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid var(--border-color)",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>
                          Create rule for future transactions
                        </span>
                        <button
                          type="button"
                          onClick={() => setCreateRule((prev) => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                          style={{
                            position: "relative",
                            width: 44,
                            height: 24,
                            borderRadius: 12,
                            border: "none",
                            background: createRule[tx.id] ? "var(--accent)" : "var(--bg-secondary)",
                            cursor: "pointer",
                            transition: "background 0.2s ease",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              left: createRule[tx.id] ? 22 : 2,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "white",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                              transition: "left 0.2s ease",
                            }}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Category selector - single searchable dropdown */}
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 240 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Category
                  </label>
                  <SubcategorySearch
                    categories={categories}
                    subcategories={subcategories}
                    value={subcategory[tx.id] || ""}
                    onChange={(subId, catId) => {
                      setSubcategory((prev) => ({ ...prev, [tx.id]: subId }));
                      setCategory((prev) => ({ ...prev, [tx.id]: catId }));
                    }}
                    placeholder="Search categories..."
                  />
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
                  {aiStatus?.configured && (
                    <button
                      onClick={() => aiCategorizeSingle(tx.id)}
                      disabled={aiProcessingTx[tx.id]}
                      title="Categorize with AI"
                      style={{
                        flex: 0,
                        padding: "0.5rem 0.75rem",
                        background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {aiProcessingTx[tx.id] ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: "spin 1s linear infinite" }}>
                          <circle cx="12" cy="12" r="10" strokeWidth={2} strokeDasharray="31.4" strokeDashoffset="10" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    className="primary"
                    onClick={() => submit(tx.id)}
                    disabled={!category[tx.id] || saving[tx.id]}
                    style={{ flex: 1 }}
                  >
                    {saving[tx.id]
                      ? "Saving..."
                      : willApplyToSimilar
                        ? `Save ${similar?.count || 1}`
                        : "Save"
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

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

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default ReviewQueue;
