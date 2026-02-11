import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import type { Category, Subcategory, Transaction } from "../App";
import LinkTransactionModal from "./LinkTransactionModal";
import EditTransactionModal from "./EditTransactionModal";
import SubcategorySearch from "./SubcategorySearch";
import Select from "./ui/Select";
import { PageLoading } from "./ui/Loading";

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

// HIGH-002: XSS Sanitization helper
const sanitizeHtml = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const sanitizeForDisplay = (value: unknown): string => {
  if (typeof value !== 'string') return String(value);
  return sanitizeHtml(value);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

type DateRange = "7d" | "30d" | "90d" | "year" | "all" | "custom";

const getDateRange = (range: DateRange, customStart?: string, customEnd?: string) => {
  const now = new Date();
  let startDate = "";
  let endDate = now.toISOString().split("T")[0];

  switch (range) {
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
    case "all":
      startDate = "";
      endDate = "";
      break;
    case "custom":
      startDate = customStart || "";
      endDate = customEnd || endDate;
      break;
  }

  return { startDate, endDate };
};

function Transactions({ apiBase, categories, subcategories, refreshKey, onUpdated }: Props) {
  // Init state from URL
  const getParams = () => new URLSearchParams(window.location.search);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<string>(() => getParams().get("cat") || "");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>(() => getParams().get("sub") || "");
  const [searchQuery, setSearchQuery] = useState(() => getParams().get("q") || "");

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => {
    const p = parseInt(getParams().get("page") || "1");
    return Math.max(0, p - 1);
  });
  const pageSize = 25;

  // AI Search State
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiFilters, setAIFilters] = useState<any>(null);
  const [rawAIFilters, setRawAIFilters] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const p = getParams();
    if (p.get("start") || p.get("end")) return "custom";
    if (p.get("range")) return p.get("range") as DateRange;
    return "30d";
  });
  const [customStartDate, setCustomStartDate] = useState(() => getParams().get("start") || "");
  const [customEndDate, setCustomEndDate] = useState(() => getParams().get("end") || "");

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Link modal state
  const [linkingTx, setLinkingTx] = useState<Transaction | null>(null);

  // Sync state TO URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Function to set/delete param
    const update = (key: string, val: string | null) => val ? params.set(key, val) : params.delete(key);

    update("cat", categoryFilter);
    update("sub", subcategoryFilter);
    update("q", searchQuery);
    update("page", (page + 1).toString());

    if (dateRange !== "30d") update("range", dateRange);
    else params.delete("range");

    if (dateRange === "custom") {
      update("start", customStartDate);
      update("end", customEndDate);
    } else {
      params.delete("start");
      params.delete("end");
    }

    // Always keep tab=transactions if we are here
    params.set("tab", "transactions");

    window.history.replaceState({}, "", "?" + params.toString());
  }, [categoryFilter, subcategoryFilter, searchQuery, page, dateRange, customStartDate, customEndDate]);

  // Reset subcategory when category changes (only if user interaction? No, simplistic is fine for now)
  // But wait, if URL loads both cat & sub, this effect might clear sub?
  // We need to avoid clearing sub on initial load.
  // We can track previous category.
  useEffect(() => {
    // If subcategory is set and valid for category... 
    // For now, let's skip auto-reset to support deep linking better. 
    // If user changes category, subcategory persists until they change it or it becomes invalid (backend filters).
    // Ideally we want to clear key if it doesn't match?
    // Let's assume user knows what they are doing or standard UI handles it.
    // Removing this effect allows URL ?cat=1&sub=2 to work.
  }, [categoryFilter]);

  useEffect(() => {
    if (isAIMode) {
      // In AI mode, we use executeAISearch for refresh too
      executeAISearch(page, true);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();

    // Add date range params
    const { startDate, endDate } = getDateRange(dateRange, customStartDate, customEndDate);
    if (startDate) {
      params.append("start_date", startDate);
    }
    if (endDate) {
      params.append("end_date", endDate + " 23:59:59");
    }

    if (categoryFilter) {
      params.append("category_id", categoryFilter);
    }
    if (subcategoryFilter) {
      params.append("subcategory_id", subcategoryFilter);
    }
    fetchWithAuth(`${apiBase}/transactions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => {
        setTransactions([]);
        setLoading(false);
      });
  }, [apiBase, categoryFilter, subcategoryFilter, refreshKey, dateRange, customStartDate, customEndDate, isAIMode]);

  // Reset page when filters change (but not on refreshKey)
  useEffect(() => {
    setPage(0);
  }, [categoryFilter, subcategoryFilter, searchQuery, dateRange, customStartDate, customEndDate]);

  const executeAISearch = async (targetPage: number, useExistingFilters: boolean) => {
    setLoading(true);
    try {
      const payload: any = {
        page: targetPage + 1, // Backend is 1-indexed
        page_size: pageSize
      };

      if (useExistingFilters && rawAIFilters) {
        payload.filters = rawAIFilters;
      } else {
        payload.query = searchQuery;
      }

      const res = await fetchWithAuth(`${apiBase}/transactions/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // Update data
      setTransactions(data.results || []);
      setTotalCount(data.total || 0);

      if (!useExistingFilters) {
        // Map standard filters to UI state (only on initial search)
        const filters = data.filters || {};
        const remainingFilters: any = { ...filters };
        setRawAIFilters(filters); // Store full filters for pagination reuse

        // 1. Date Range
        if (filters.start_date || filters.end_date) {
          setDateRange("custom");
          if (filters.start_date) setCustomStartDate(filters.start_date);
          if (filters.end_date) setCustomEndDate(filters.end_date);
          delete remainingFilters.start_date;
          delete remainingFilters.end_date;
        } else {
          // Default to All Time if AI didn't specify a date to avoid hiding historical matches
          setDateRange("all");
        }

        // 2. Category
        if (filters.category_id) {
          setCategoryFilter(filters.category_id.toString());
          delete remainingFilters.category_id;
          delete remainingFilters.category;
        }

        // 3. Subcategory
        if (filters.subcategory_id) {
          setSubcategoryFilter(filters.subcategory_id.toString());
          delete remainingFilters.subcategory_id;
          delete remainingFilters.subcategory;
        }

        setAIFilters(Object.keys(remainingFilters).length > 0 ? remainingFilters : null);
        setIsAIMode(true);
      }

      setPage(targetPage);
    } catch (e) {
      console.error(e);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAISearch = () => {
    if (!searchQuery.trim()) return;
    executeAISearch(0, false);
  };

  // Trigger AI search on mount if query exists
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const p = parseInt(params.get("page") || "1") - 1;
    if (q) {
      executeAISearch(Math.max(0, p), false);
    }
  }, []);

  const filteredTransactions = isAIMode
    ? transactions
    : searchQuery
      ? transactions.filter((tx) =>
        tx.description_raw.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : transactions;

  const pagedTransactions = isAIMode
    ? transactions
    : filteredTransactions.slice(
      page * pageSize,
      (page + 1) * pageSize
    );

  const totalPages = isAIMode
    ? Math.ceil(totalCount / pageSize)
    : Math.ceil(filteredTransactions.length / pageSize);

  // Only calculate amount for client-side validset (approximate for AI mode? Or use total from backend? Backend logic implies sum of ALL results? 
  // For now, let's just sum what we see or disable total amount in AI mode if it's confusing. 
  // Actually, showing sum of *visible* page is consistent.
  const totalAmount = pagedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Open edit modal
  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
  };

  // Close modal
  const closeEdit = () => {
    setEditingTx(null);
  };





  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Date Range Filter */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {(["7d", "30d", "90d", "year", "all"] as DateRange[]).map((range) => (
            <button
              key={range}
              className={dateRange === range ? "primary" : "secondary"}
              onClick={() => setDateRange(range)}
              style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
            >
              {range === "7d" ? "7 Days" :
                range === "30d" ? "30 Days" :
                  range === "90d" ? "90 Days" :
                    range === "year" ? "1 Year" : "All Time"}
            </button>
          ))}
          <button
            className={dateRange === "custom" ? "primary" : "secondary"}
            onClick={() => setDateRange("custom")}
            style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
          >
            Custom
          </button>

          {dateRange === "custom" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: "0.5rem" }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: "0.5rem", fontSize: "0.8125rem" }}
              />
              <span style={{ color: "var(--text-muted)" }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: "0.5rem", fontSize: "0.8125rem" }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Search & Category Filters */}
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
              placeholder={isAIMode ? "Refine AI search..." : "Search transactions... (Type & Enter for AI)"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAISearch();
              }}
              style={{ paddingLeft: 40, paddingRight: searchQuery ? 60 : 40, width: "100%" }}
            />

            {/* AI Sparkle Button */}
            {!isAIMode && searchQuery && (
              <button
                onClick={handleAISearch}
                style={{
                  position: "absolute",
                  right: 30, // Left of clear button if present
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: "4px",
                }}
                title="AI Smart Search"
              >
                ✨
              </button>
            )}

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  if (isAIMode) {
                    setIsAIMode(false);
                    setAIFilters(null);
                  }
                }}
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
            <Select
              value={categoryFilter || ""}
              onChange={(val) => setCategoryFilter(String(val))}
              options={[
                { value: "", label: "All categories" },
                ...categories.map(c => ({ value: c.id, label: c.name }))
              ]}
              placeholder="Categories"
              style={{ width: "100%" }}
            />
          </div>

          {/* Subcategory filter */}
          <div style={{ flex: "0 0 200px" }}>
            <Select
              value={subcategoryFilter || ""}
              onChange={(val) => setSubcategoryFilter(String(val))}
              options={[
                { value: "", label: "All subcategories" },
                ...subcategories
                  .filter(sub => sub.category_id === parseInt(categoryFilter))
                  .map(sub => ({ value: sub.id, label: sub.name }))
              ]}
              placeholder="Subcategories"
              style={{ width: "100%", opacity: categoryFilter ? 1 : 0.5, pointerEvents: categoryFilter ? "auto" : "none" }}
            />
          </div>

          {/* Summary */}
          <div style={{ flex: "0 0 auto", textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {isAIMode ? (
                <span>
                  Found <strong>{totalCount}</strong> transactions
                </span>
              ) : searchQuery ? (
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

          {/* Export Button */}
          <button
            onClick={() => {
              const params = new URLSearchParams();
              const { startDate, endDate } = getDateRange(dateRange, customStartDate, customEndDate);
              if (startDate) params.append("start_date", startDate);
              if (endDate) params.append("end_date", endDate + " 23:59:59");
              if (categoryFilter) params.append("category_id", categoryFilter);
              if (subcategoryFilter) params.append("subcategory_id", subcategoryFilter);
              window.open(`${apiBase}/transactions/export?${params.toString()}`, "_blank");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.8125rem",
            }}
            title="Export to CSV"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* AI Filters Display */}
      {isAIMode && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "-1rem", paddingLeft: "0.5rem" }}>
          {/* Clear Button - Prominent if in AI mode */}
          <button
            className="text-btn"
            onClick={() => {
              setIsAIMode(false);
              setAIFilters(null);
              setRawAIFilters(null);
              setTotalCount(0);
              setSearchQuery("");
              // Optional: Reset other filters? Maybe not, user might want to keep the context.
              // But usually clearing search means reset.
              setCategoryFilter("");
              setDateRange("30d");
              setPage(0);
            }}
            style={{
              fontSize: "0.75rem",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "var(--bg-input)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)"
            }}
          >
            ← Clear AI Search
          </button>

          {aiFilters && Object.entries(aiFilters).map(([key, value]) => {
            if (!value) return null;
            // Beautify keys
            const label = key.replace(/_/g, " ").replace("amount", "");
            return (
              <span key={key} className="badge" style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px"
              }}>
                <span style={{ color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                  {label}
                </span>
                {String(value)}
              </span>
            );
          })}
        </div>
      )}


      {/* Transactions Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <PageLoading text="Loading transactions..." />
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
                    <th style={{ width: 140 }}>Account</th>
                    <th>Description</th>
                    <th style={{ width: 140 }}>Category</th>
                    <th style={{ width: 120, textAlign: "right" }}>Amount</th>
                    <th style={{ width: 50 }}></th>
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
                            maxWidth: 140,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                          }}
                          title={tx.account_name || "Unknown"}
                        >
                          {tx.account_name || "Unknown"}
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
                        {tx.notes && (
                          <div
                            style={{
                              maxWidth: 400,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              marginTop: "2px",
                              fontStyle: "italic",
                            }}
                            title={tx.notes}
                          >
                            📝 {tx.notes}
                          </div>
                        )}
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
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLinkingTx(tx);
                          }}
                          title="Link to CC payment"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "0.375rem",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all var(--transition-fast)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--bg-input)";
                            e.currentTarget.style.color = "var(--accent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--text-muted)";
                          }}
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
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
                  {Math.min((page + 1) * pageSize, isAIMode ? totalCount : filteredTransactions.length)} of{" "}
                  {isAIMode ? totalCount : filteredTransactions.length}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="secondary"
                    onClick={() => {
                      const newPage = Math.max(0, page - 1);
                      if (isAIMode) {
                        executeAISearch(newPage, true);
                      } else {
                        setPage(newPage);
                      }
                    }}
                    disabled={page === 0}
                    style={{ padding: "0.5rem 1rem" }}
                  >
                    Previous
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      const newPage = Math.min(totalPages - 1, page + 1);
                      if (isAIMode) {
                        executeAISearch(newPage, true);
                      } else {
                        setPage(newPage);
                      }
                    }}
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
      {
        editingTx && (
          <EditTransactionModal
            transaction={editingTx}
            isOpen={!!editingTx}
            onClose={closeEdit}
            onSave={async () => {
              onUpdated?.();
            }}
            categories={categories}
            subcategories={subcategories}
            apiBase={apiBase}
          />
        )
      }

      {/* Link Transaction Modal */}
      {
        linkingTx && (
          <LinkTransactionModal
            apiBase={apiBase}
            transaction={{
              id: linkingTx.id,
              amount: linkingTx.amount,
              description_raw: linkingTx.description_raw,
              posted_at: linkingTx.posted_at,
            }}
            onClose={() => setLinkingTx(null)}
            onLinked={() => {
              setLinkingTx(null);
              onUpdated?.();
            }}
          />
        )
      }

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
    </div >
  );
}

export default Transactions;
