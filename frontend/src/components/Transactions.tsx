import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchWithAuth } from "../utils/api";
import type { Category, Subcategory, Transaction } from "../App";
import LinkTransactionModal from "./LinkTransactionModal";
import EditTransactionModal from "./EditTransactionModal";
import SmartFilters, { type FilterState } from "./SmartFilters";
import { PageLoading } from "./ui/Loading";
import { createPortal } from "react-dom";
import SwipeableCard from "./SwipeableCard";
import { useTrashBin } from "../hooks/useTrashBin";

// Hook to detect mobile view
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  return isMobile;
};

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

// Helper function to get category color
const getCategoryColor = (categoryId: number | null, cats: Category[]): string | null => {
  if (!categoryId) return null;
  const cat = cats.find(c => c.id === categoryId);
  return cat?.color || null;
};

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

// Mobile Transaction List Component with Swipe Actions
interface MobileTransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  subcategories: Subcategory[];
  selectedTransactions: Set<number>;
  onToggleSelection: (id: number) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: number) => void;
  onLink: (tx: Transaction) => void;
}

const MobileTransactionList: React.FC<MobileTransactionListProps> = ({
  transactions,
  categories,
  selectedTransactions,
  onToggleSelection,
  onEdit,
  onDelete,
}) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "Uncategorized";
    return categories.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  const getCategoryColor = (categoryId: number | null) => {
    if (!categoryId) return "#64748b";
    return categories.find((c) => c.id === categoryId)?.color || "#64748b";
  };

  return (
    <div className="mobile-transaction-list" style={{ display: "none" }}>
      <style>{
        `
          @media (max-width: 768px) {
            .mobile-transaction-list { display: block !important; }
            .mobile-transaction-list + div { display: none !important; }
            .mobile-transaction-list ~ div table { display: none !important; }
          }
        `
      }</style>
      {transactions.map((tx, idx) => {
        const isSelected = selectedTransactions.has(tx.id);
        const categoryName = getCategoryName(tx.category_id);
        const categoryColor = getCategoryColor(tx.category_id);
        const isExpense = tx.amount < 0;

        const swipeActions = [
          {
            label: "Edit",
            color: "#3b82f6",
            icon: (
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            ),
            onClick: () => onEdit(tx),
          },
          {
            label: "Delete",
            color: "#ef4444",
            icon: (
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ),
            onClick: () => onDelete(tx.id),
            destructive: true,
          },
        ];

        return (
          <SwipeableCard
            key={tx.id}
            actions={swipeActions}
            style={{ marginBottom: idx === transactions.length - 1 ? 0 : "8px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: isSelected ? "var(--accent-glow)" : "var(--bg-card)",
                borderRadius: "var(--radius-md)",
              }}
              onClick={() => onEdit(tx)}
            >
              {/* Checkbox */}
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelection(tx.id)}
                  style={{ cursor: "pointer" }}
                />
              </div>

              {/* Category indicator */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: `${categoryColor}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: categoryColor,
                  }}
                />
              </div>

              {/* Transaction info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: "4px",
                  }}
                  title={tx.description_norm}
                >
                  {tx.description_norm}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{formatDate(tx.posted_at)}</span>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span>{categoryName}</span>
                </div>
              </div>

              {/* Amount */}
              <div
                style={{
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: isExpense ? "var(--danger)" : "var(--success)",
                  }}
                >
                  {isExpense ? "-" : "+"}
                  {formatCurrency(Math.abs(tx.amount))}
                </div>
              </div>
            </div>
          </SwipeableCard>
        );
      })}
    </div>
  );
};

function Transactions({ apiBase, categories, subcategories, refreshKey, onUpdated }: Props) {
  // Init state from URL
  const getParams = () => new URLSearchParams(window.location.search);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => {
    const p = parseInt(getParams().get("page") || "1");
    return Math.max(0, p - 1);
  });
  const pageSize = 25;

  // Feature 8: Bulk Edit State
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<string>("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionError, setBulkActionError] = useState("");

  // AI Search State
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiFilters, setAIFilters] = useState<any>(null);
  const [rawAIFilters, setRawAIFilters] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Feature 7: Smart Search - Enhanced Filter State
  const [filters, setFilters] = useState<FilterState>(() => {
    const p = getParams();
    const pRange = p.get("range") as FilterState["dateRange"];
    return {
      searchQuery: p.get("q") || "",
      categoryId: p.get("cat") || "",
      subcategoryId: p.get("sub") || "",
      dateRange: (pRange || "30d") as FilterState["dateRange"],
      customStartDate: p.get("start") || "",
      customEndDate: p.get("end") || "",
      minAmount: p.get("minAmount") || "",
      maxAmount: p.get("maxAmount") || "",
      transactionType: (p.get("type") as FilterState["transactionType"]) || "all",
      sortBy: (p.get("sort") as FilterState["sortBy"]) || "date",
      sortOrder: (p.get("order") as FilterState["sortOrder"]) || "desc",
    };
  });

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Link modal state
  const [linkingTx, setLinkingTx] = useState<Transaction | null>(null);

  // Touch gestures (swipe to delete) - Feature 2
  const { softDelete } = useTrashBin({ apiBase });

  const handleSoftDelete = async (id: number) => {
    const result = await softDelete("transactions", id);
    if (result.success) {
      // Remove from local state
      setTransactions(prev => prev.filter(tx => tx.id !== id));
      onUpdated?.();
    } else {
      console.error("Failed to delete transaction:", result.error);
    }
  };

  // Sync state TO URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Function to set/delete param
    const update = (key: string, val: string | null) => val ? params.set(key, val) : params.delete(key);

    update("cat", filters.categoryId);
    update("sub", filters.subcategoryId);
    update("q", filters.searchQuery);
    update("page", (page + 1).toString());
    update("type", filters.transactionType === "all" ? null : filters.transactionType);
    update("sort", filters.sortBy === "date" ? null : filters.sortBy);
    update("order", filters.sortOrder === "desc" ? null : filters.sortOrder);
    update("minAmount", filters.minAmount);
    update("maxAmount", filters.maxAmount);

    if (filters.dateRange !== "30d") update("range", filters.dateRange);
    else params.delete("range");

    if (filters.dateRange === "custom") {
      update("start", filters.customStartDate);
      update("end", filters.customEndDate);
    } else {
      params.delete("start");
      params.delete("end");
    }

    // Always keep tab=transactions if we are here
    params.set("tab", "transactions");

    window.history.replaceState({}, "", "?" + params.toString());
  }, [filters, page, isAIMode]);

  // Reset page when filters change

  useEffect(() => {
    if (isAIMode) return; // AI mode uses executeAISearch

    setLoading(true);
    const params = new URLSearchParams();

    // Add date range params using filters
    const { startDate, endDate } = getDateRange(filters.dateRange, filters.customStartDate, filters.customEndDate);
    if (startDate) {
      params.append("start_date", startDate);
    }
    if (endDate) {
      params.append("end_date", endDate);
    }

    if (filters.categoryId) {
      params.append("category_id", filters.categoryId);
    }
    if (filters.subcategoryId) {
      params.append("subcategory_id", filters.subcategoryId);
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
  }, [apiBase, filters.categoryId, filters.subcategoryId, refreshKey, filters.dateRange, filters.customStartDate, filters.customEndDate, isAIMode]);

  // Reset page when filters change (but not on refreshKey)
  useEffect(() => {
    setPage(0);
    // Clear selection when filters change
    setSelectedTransactions(new Set());
  }, [filters]);

  // Feature 8: Bulk Edit Helpers
  const toggleTransactionSelection = (txId: number) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    const newSet = new Set(selectedTransactions);
    pagedTransactions.forEach(tx => newSet.add(tx.id));
    setSelectedTransactions(newSet);
  };

  const selectNone = () => {
    setSelectedTransactions(new Set());
  };

  const handleBulkCategorize = async () => {
    if (!bulkCategoryId || selectedTransactions.size === 0) return;
    
    setBulkActionLoading(true);
    setBulkActionError("");
    
    try {
      const formData = new FormData();
      formData.append("transaction_ids", JSON.stringify(Array.from(selectedTransactions)));
      formData.append("category_id", bulkCategoryId);
      if (bulkSubcategoryId) {
        formData.append("subcategory_id", bulkSubcategoryId);
      }
      
      const res = await fetchWithAuth(`${apiBase}/transactions/bulk-update`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to categorize transactions");
      }
      
      setShowBulkCategoryModal(false);
      setSelectedTransactions(new Set());
      onUpdated?.();
    } catch (err) {
      setBulkActionError(err instanceof Error ? err.message : "Failed to categorize");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;
    
    setBulkActionLoading(true);
    setBulkActionError("");
    
    try {
      const formData = new FormData();
      formData.append("transaction_ids", JSON.stringify(Array.from(selectedTransactions)));
      
      const res = await fetchWithAuth(`${apiBase}/transactions/bulk-delete`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete transactions");
      }
      
      setShowBulkDeleteModal(false);
      setSelectedTransactions(new Set());
      onUpdated?.();
    } catch (err) {
      setBulkActionError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBulkActionLoading(false);
    }
  };

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
        payload.query = filters.searchQuery;
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
        const aiFiltersData = data.filters || {};
        const remainingFilters: any = { ...aiFiltersData };
        setRawAIFilters(aiFiltersData); // Store full filters for pagination reuse

        const newFilters: Partial<FilterState> = {};

        // 1. Date Range
        if (aiFiltersData.start_date || aiFiltersData.end_date) {
          newFilters.dateRange = "custom";
          newFilters.customStartDate = aiFiltersData.start_date || "";
          newFilters.customEndDate = aiFiltersData.end_date || "";
        } else {
          newFilters.dateRange = "all";
        }
        delete remainingFilters.start_date;
        delete remainingFilters.end_date;

        // 2. Category
        if (aiFiltersData.category_id) {
          newFilters.categoryId = aiFiltersData.category_id.toString();
          delete remainingFilters.category_id;
          delete remainingFilters.category;
        }

        // 3. Subcategory
        if (aiFiltersData.subcategory_id) {
          newFilters.subcategoryId = aiFiltersData.subcategory_id.toString();
          delete remainingFilters.subcategory_id;
          delete remainingFilters.subcategory;
        }

        setFilters((prev) => ({ ...prev, ...newFilters }));
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
    if (!filters.searchQuery.trim()) return;
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

  // Feature 7: Smart filtering - Apply all client-side filters
  const filteredTransactions = useMemo(() => {
    if (isAIMode) return transactions;
    
    let filtered = transactions;
    
    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((tx) =>
        tx.description_raw.toLowerCase().includes(query) ||
        (tx.account_name?.toLowerCase().includes(query) ?? false)
      );
    }
    
    // Category filter
    if (filters.categoryId) {
      filtered = filtered.filter((tx) => tx.category_id === parseInt(filters.categoryId));
    }
    
    // Subcategory filter
    if (filters.subcategoryId) {
      filtered = filtered.filter((tx) => tx.subcategory_id === parseInt(filters.subcategoryId));
    }
    
    // Amount filter
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      filtered = filtered.filter((tx) => Math.abs(tx.amount) >= min);
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      filtered = filtered.filter((tx) => Math.abs(tx.amount) <= max);
    }
    
    // Transaction type filter
    if (filters.transactionType === "expense") {
      filtered = filtered.filter((tx) => tx.amount < 0);
    } else if (filters.transactionType === "income") {
      filtered = filtered.filter((tx) => tx.amount > 0);
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      let result = 0;
      switch (filters.sortBy) {
        case "date":
          result = new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
          break;
        case "amount":
          result = Math.abs(b.amount) - Math.abs(a.amount);
          break;
        case "category":
          const catA = categories.find((c) => c.id === a.category_id)?.name || "";
          const catB = categories.find((c) => c.id === b.category_id)?.name || "";
          result = catA.localeCompare(catB);
          break;
      }
      return filters.sortOrder === "asc" ? -result : result;
    });
    
    return filtered;
  }, [transactions, filters, isAIMode, categories]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Disable AI mode when changing filters manually
    if (isAIMode) {
      setIsAIMode(false);
      setAIFilters(null);
      setRawAIFilters(null);
    }
  }, [isAIMode]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      searchQuery: "",
      categoryId: "",
      subcategoryId: "",
      dateRange: "30d",
      customStartDate: "",
      customEndDate: "",
      minAmount: "",
      maxAmount: "",
      transactionType: "all",
      sortBy: "date",
      sortOrder: "desc",
    });
    setIsAIMode(false);
    setAIFilters(null);
    setRawAIFilters(null);
  }, []);

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





  // Export with current filters
  const handleExport = useCallback(() => {
    setFilters((currentFilters) => {
      const params = new URLSearchParams();
      const { startDate, endDate } = getDateRange(currentFilters.dateRange, currentFilters.customStartDate, currentFilters.customEndDate);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (currentFilters.categoryId) params.append("category_id", currentFilters.categoryId);
      if (currentFilters.subcategoryId) params.append("subcategory_id", currentFilters.subcategoryId);
      if (currentFilters.minAmount) params.append("min_amount", currentFilters.minAmount);
      if (currentFilters.maxAmount) params.append("max_amount", currentFilters.maxAmount);
      window.open(`${apiBase}/transactions/export?${params.toString()}`, "_blank");
      return currentFilters;
    });
  }, [apiBase]);

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Feature 7: Smart Search with Enhanced Filters */}
      <SmartFilters
        categories={categories}
        subcategories={subcategories}
        filters={filters}
        onChange={handleFiltersChange}
        onClear={handleClearFilters}
        resultCount={isAIMode ? transactions.length : filteredTransactions.length}
        totalCount={isAIMode ? totalCount : transactions.length}
        isAIMode={isAIMode}
        onAISearch={handleAISearch}
      />

      {/* AI Mode Indicator */}
      {isAIMode && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", paddingLeft: "0.5rem", marginTop: "-0.5rem" }}>
          <span className="badge" style={{
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color: "#fff",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.375rem 0.75rem"
          }}>
            <span>✨</span>
            AI Search Active
            <button
              onClick={() => {
                setIsAIMode(false);
                setAIFilters(null);
                setRawAIFilters(null);
                handleClearFilters();
              }}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.625rem",
                padding: "2px 6px",
                borderRadius: "4px",
                marginLeft: "0.25rem"
              }}
            >
              ✕
            </button>
          </span>
          {aiFilters && Object.entries(aiFilters).map(([key, value]) => {
            if (!value) return null;
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
                padding: "4px 8px",
                fontSize: "0.8125rem"
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

      {/* Export Button */}
      <div style={{ padding: "0 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Feature 8: Bulk Actions Toolbar */}
        {selectedTransactions.size > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginRight: "0.5rem" }}>
              {selectedTransactions.size} selected
            </span>
            <button
              onClick={selectNone}
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.8125rem",
              }}
            >
              Select None
            </button>
            <button
              onClick={() => setShowBulkCategoryModal(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--accent)",
                border: "none",
                borderRadius: "var(--radius-md)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.8125rem",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Categorize
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--danger)",
                border: "none",
                borderRadius: "var(--radius-md)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.8125rem",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}
        {selectedTransactions.size === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={selectAllVisible}
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.8125rem",
              }}
            >
              Select All
            </button>
          </div>
        )}
        <button
          onClick={handleExport}
          disabled={!isAIMode && filteredTransactions.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-secondary)",
            cursor: (!isAIMode && filteredTransactions.length === 0) ? "not-allowed" : "pointer",
            fontSize: "0.8125rem",
            opacity: (!isAIMode && filteredTransactions.length === 0) ? 0.5 : 1,
          }}
          title="Export filtered results to CSV"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>


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
              {filters.searchQuery ? "Try a different search term" : "Import a statement to get started"}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    {/* Feature 8: Checkbox column */}
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={
                          pagedTransactions.length > 0 && 
                          pagedTransactions.every(tx => selectedTransactions.has(tx.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllVisible();
                          } else {
                            setSelectedTransactions(prev => {
                              const newSet = new Set(prev);
                              pagedTransactions.forEach(tx => newSet.delete(tx.id));
                              return newSet;
                            });
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
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
                        background: selectedTransactions.has(tx.id) ? "var(--accent-glow)" : undefined,
                      }}
                      onClick={() => openEdit(tx)}
                      title="Click to edit"
                    >
                      {/* Feature 8: Checkbox cell  */}
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(tx.id)}
                          onChange={() => toggleTransactionSelection(tx.id)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
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
                                : getCategoryColor(tx.category_id, categories) ? `${getCategoryColor(tx.category_id, categories)}20`
                                : "var(--accent-glow)",
                              color: tx.is_uncertain ? "var(--warning)" : getCategoryColor(tx.category_id, categories) || "var(--accent)",
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {getCategoryColor(tx.category_id, categories) && (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: getCategoryColor(tx.category_id, categories) || undefined,
                                  display: 'inline-block',
                                }}
                              />
                            )}
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

            {/* Mobile Swipeable List View */}
            <MobileTransactionList 
              transactions={pagedTransactions}
              categories={categories}
              subcategories={subcategories}
              selectedTransactions={selectedTransactions}
              onToggleSelection={toggleTransactionSelection}
              onEdit={openEdit}
              onDelete={handleSoftDelete}
              onLink={(tx) => setLinkingTx(tx)}
            />

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

      {/* Feature 8: Bulk Categorize Modal */}
      {showBulkCategoryModal && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowBulkCategoryModal(false)}
        >
          <div className="card" style={{ width: "100%", maxWidth: "400px", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Categorize {selectedTransactions.size} Transactions</h3>
            
            <div style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category *
                </label>
                <select
                  value={bulkCategoryId}
                  onChange={(e) => {
                    setBulkCategoryId(e.target.value);
                    setBulkSubcategoryId("");
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              {bulkCategoryId && subcategories.filter((s) => s.category_id === parseInt(bulkCategoryId)).length > 0 && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Subcategory
                  </label>
                  <select
                    value={bulkSubcategoryId}
                    onChange={(e) => setBulkSubcategoryId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-input)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">Select subcategory...</option>
                    {subcategories
                      .filter((s) => s.category_id === parseInt(bulkCategoryId))
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            
            {bulkActionError && (
              <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem" }}>
                {bulkActionError}
              </div>
            )}
            
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowBulkCategoryModal(false)}
                disabled={bulkActionLoading}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCategorize}
                disabled={bulkActionLoading || !bulkCategoryId}
                style={{
                  padding: "0.5rem 1rem",
                  background: bulkCategoryId ? "var(--accent)" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  color: "#fff",
                  cursor: bulkCategoryId ? "pointer" : "not-allowed",
                  opacity: bulkCategoryId ? 1 : 0.5,
                }}
              >
                {bulkActionLoading ? "Categorizing..." : "Apply"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Feature 8: Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => e.target === e.currentTarget && setShowBulkDeleteModal(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "1.5rem",
              animation: "slideIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "var(--text-primary)" }}>Delete Transactions</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              Are you sure you want to delete <strong>{selectedTransactions.size}</strong> transactions? This action cannot be undone.
            </p>

            {bulkActionError && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid var(--danger)",
                  borderRadius: "0.5rem",
                  marginBottom: "1.5rem",
                  fontSize: "0.875rem",
                  color: "var(--danger)",
                }}
              >
                {bulkActionError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button 
                className="secondary" 
                onClick={() => setShowBulkDeleteModal(false)} 
                disabled={bulkActionLoading}
              >
                Cancel
              </button>
              <button
                className="danger"
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                {bulkActionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
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
    </div >
  );
}

export default Transactions;
