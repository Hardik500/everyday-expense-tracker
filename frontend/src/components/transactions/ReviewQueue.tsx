import { useEffect, useState, useMemo } from "react";
import { fetchWithAuth } from "../../utils/api";
import type { Category, Subcategory, Transaction } from "../types";
import AISuggestions from "./AISuggestions";
import SubcategorySearch from "../categories/SubcategorySearch";
import { useToast } from "../common/Toast";
import { PageLoading } from "../ui/Loading";

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

// Toggle component
const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="relative w-11 h-6 rounded-full border-none cursor-pointer transition-colors shrink-0"
    style={{ background: checked ? "var(--accent)" : "var(--bg-secondary)" }}
  >
    <span
      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
      style={{ left: checked ? "22px" : "2px" }}
    />
  </button>
);

function ReviewQueue({
  apiBase,
  categories,
  subcategories,
  refreshKey,
  onUpdated,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    fetchWithAuth(`${apiBase}/transactions?uncertain=true`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data);
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
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


  if (loading) {
    return <PageLoading text="Loading transactions..." />;
  }

  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-4 font-medium text-success">All caught up!</p>
          <p className="mt-2">No transactions need review right now</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* AI Category Suggestions */}
      <AISuggestions apiBase={apiBase} refreshKey={refreshKey} onUpdated={onUpdated} />

      {/* Progress indicator */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-text-primary text-[0.9375rem]">
                {transactions.length} transactions need review
              </div>
              <div className="text-sm text-text-muted">
                Assign categories to help track your spending
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* AI Categorize Button */}
            {aiStatus?.configured && (
              <button
                onClick={aiCategorizeAll}
                disabled={aiLoading}
                className="primary flex items-center gap-2 bg-gradient-to-br from-purple-500 to-indigo-500"
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
              <div className="text-xs text-text-muted px-3 py-2 bg-bg-input rounded-lg">
                💡 Set GEMINI_API_KEY to enable AI
              </div>
            )}
            <div className="text-sm text-text-muted">
              Page {page + 1} of {totalPages}
            </div>
          </div>
        </div>

        {/* AI Progress Bar */}
        {aiProgress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span>AI categorizing transactions...</span>
              <span>{aiProgress.processed} of {aiProgress.total} categorized</span>
            </div>
            <div className="h-1 bg-bg-input rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all"
                style={{ width: `${(aiProgress.processed / Math.max(aiProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction cards */}
      {pagedTransactions.map((tx) => {
        const similar = similarInfo[tx.id];
        const hasSimilar = similar && similar.count > 1;
        const willApplyToSimilar = applyToSimilar[tx.id] && hasSimilar;
        const isLoadingSimilar = !similar && !similarInfo[tx.id];

        return (
          <div
            key={tx.id}
            className="card card-stable p-5"
          >
            <div className="flex gap-6 flex-wrap">
              {/* Transaction info */}
              <div className="flex-[1_1_300px] min-w-0">
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-10 h-10 rounded-[10px] bg-bg-input flex items-center justify-center shrink-0 text-text-muted">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-medium text-text-primary text-[0.9375rem] whitespace-nowrap overflow-hidden text-ellipsis"
                      title={tx.description_raw}
                    >
                      {tx.description_raw}
                    </div>
                    <div className="text-sm text-text-muted mt-1">
                      {formatDate(tx.posted_at)}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div
                  className={`mono text-2xl font-semibold ${tx.amount < 0 ? "text-danger" : "text-success"}`}
                >
                  {tx.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(tx.amount))}
                </div>

                {/* Similar transactions info */}
                {isLoadingSimilar ? (
                  <div className="mt-4 h-20 rounded-lg bg-bg-input animate-pulse" />
                ) : hasSimilar ? (
                  <div className="mt-4 p-4 bg-bg-input rounded-lg text-sm">
                    {/* Apply to similar toggle */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-text-primary font-medium">
                        Apply to {similar.count} similar transactions
                      </span>
                      <Toggle
                        checked={applyToSimilar[tx.id]}
                        onChange={(val) => setApplyToSimilar((prev) => ({ ...prev, [tx.id]: val }))}
                      />
                    </div>

                    {/* Pattern - editable */}
                    <div className="mt-3">
                      <label className="text-xs text-text-muted block mb-1">
                        Pattern (editable)
                      </label>
                      <input
                        type="text"
                        value={editedPattern[tx.id] ?? similar.pattern}
                        onChange={(e) => setEditedPattern((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-border-color bg-bg-secondary text-text-primary text-sm font-mono"
                        placeholder="Enter pattern..."
                      />
                    </div>

                    {/* Create rule toggle */}
                    {willApplyToSimilar && (
                      <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-border-color">
                        <span className="text-text-muted">
                          Create rule for future transactions
                        </span>
                        <Toggle
                          checked={createRule[tx.id]}
                          onChange={(val) => setCreateRule((prev) => ({ ...prev, [tx.id]: val }))}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Category selector - single searchable dropdown */}
              <div className="flex-[0_0_auto] flex flex-col gap-3 min-w-[240px]">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">
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
                <div className="flex gap-2 mt-1">
                  <button
                    className="ghost flex-1"
                    onClick={() => skipTransaction(tx.id)}
                    disabled={saving[tx.id]}
                  >
                    Skip
                  </button>
                  {aiStatus?.configured && (
                    <button
                      onClick={() => aiCategorizeSingle(tx.id)}
                      disabled={aiProcessingTx[tx.id]}
                      title="Categorize with AI"
                      className="px-3 py-2 bg-gradient-to-br from-purple-500 to-indigo-500 border-none rounded-lg text-white cursor-pointer flex items-center justify-center"
                    >
                      {aiProcessingTx[tx.id] ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="animate-spin">
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
                    className="primary flex-1"
                    onClick={() => submit(tx.id)}
                    disabled={!category[tx.id] || saving[tx.id]}
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
        <div className="flex justify-center gap-2 mt-2">
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