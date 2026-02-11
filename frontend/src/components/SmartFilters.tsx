/**
 * Feature 7: Smart Search with Enhanced Filters
 * 
 * This component provides advanced filtering capabilities for transactions including:
 * - Quick filter buttons for common filters
 * - Amount range filtering (min/max)
 * - Filter chips/tags for active filters
 * - Filter persistence
 * - Search suggestions
 * - Clear all filters functionality
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, Subcategory } from "../App";

export interface FilterState {
  searchQuery: string;
  categoryId: string;
  subcategoryId: string;
  dateRange: "7d" | "30d" | "90d" | "year" | "all" | "custom";
  customStartDate: string;
  customEndDate: string;
  minAmount: string;
  maxAmount: string;
  transactionType: "all" | "expense" | "income";
  sortBy: "date" | "amount" | "category";
  sortOrder: "desc" | "asc";
}

interface SmartFiltersProps {
  categories: Category[];
  subcategories: Subcategory[];
  filters: FilterState;
  onChange: (filters: Partial<FilterState>) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  isAIMode?: boolean;
  onAISearch?: () => void;
}

interface QuickFilter {
  id: string;
  label: string;
  icon: string;
  getFilters: () => Partial<FilterState>;
}

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
};

const SmartFilters: React.FC<SmartFiltersProps> = ({
  categories,
  subcategories,
  filters,
  onChange,
  onClear,
  resultCount,
  totalCount,
  isAIMode = false,
  onAISearch,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get subcategories for selected category
  const availableSubcategories = useMemo(() => {
    if (!filters.categoryId) return [];
    return subcategories.filter((s) => s.category_id === parseInt(filters.categoryId));
  }, [subcategories, filters.categoryId]);

  // Quick filters configuration
  const quickFilters: QuickFilter[] = [
    {
      id: "large-expenses",
      label: "Large Expenses",
      icon: "💸",
      getFilters: () => ({ minAmount: "5000", maxAmount: "", transactionType: "expense", dateRange: "30d" }),
    },
    {
      id: "recent-income",
      label: "Recent Income",
      icon: "💰",
      getFilters: () => ({ transactionType: "income", dateRange: "30d" }),
    },
    {
      id: "uncategorized",
      label: "Uncategorized",
      icon: "🏷️",
      getFilters: () => ({ categoryId: "", subcategoryId: "" }),
    },
    {
      id: "this-week",
      label: "This Week",
      icon: "📅",
      getFilters: () => ({ dateRange: "7d" }),
    },
  ];

  // Generate search suggestions based on categories
  useEffect(() => {
    const suggestions = [
      ...categories.map((c) => c.name),
      "food",
      "shopping",
      "bills",
      "salary",
      "uber",
      "amazon",
      "flipkart",
      "groceries",
    ];
    setSearchSuggestions(suggestions);
  }, [categories]);

  // Filter chips for active filters
  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.categoryId) {
      const cat = categories.find((c) => c.id === parseInt(filters.categoryId));
      if (cat) {
        chips.push({
          key: "category",
          label: `Category: ${cat.name}`,
          onRemove: () => onChange({ categoryId: "", subcategoryId: "" }),
        });
      }
    }

    if (filters.subcategoryId) {
      const sub = subcategories.find((s) => s.id === parseInt(filters.subcategoryId));
      if (sub) {
        chips.push({
          key: "subcategory",
          label: `Subcategory: ${sub.name}`,
          onRemove: () => onChange({ subcategoryId: "" }),
        });
      }
    }

    if (filters.minAmount || filters.maxAmount) {
      const min = filters.minAmount ? formatCurrency(parseInt(filters.minAmount)) : "₹0";
      const max = filters.maxAmount ? formatCurrency(parseInt(filters.maxAmount)) : "∞";
      chips.push({
        key: "amount",
        label: `Amount: ${min} - ${max}`,
        onRemove: () => onChange({ minAmount: "", maxAmount: "" }),
      });
    }

    if (filters.transactionType !== "all") {
      chips.push({
        key: "type",
        label: `Type: ${filters.transactionType === "expense" ? "Expenses" : "Income"}`,
        onRemove: () => onChange({ transactionType: "all" }),
      });
    }

    if (filters.dateRange !== "30d") {
      const rangeLabels: Record<string, string> = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
        year: "Past year",
        all: "All time",
        custom: "Custom range",
      };
      chips.push({
        key: "date",
        label: rangeLabels[filters.dateRange] || filters.dateRange,
        onRemove: () => onChange({ dateRange: "30d", customStartDate: "", customEndDate: "" }),
      });
    }

    if (filters.dateRange === "custom" && (filters.customStartDate || filters.customEndDate)) {
      const start = filters.customStartDate ? new Date(filters.customStartDate).toLocaleDateString("en-IN") : "Start";
      const end = filters.customEndDate ? new Date(filters.customEndDate).toLocaleDateString("en-IN") : "End";
      chips.push({
        key: "custom-date",
        label: `${start} - ${end}`,
        onRemove: () => onChange({ customStartDate: "", customEndDate: "" }),
      });
    }

    return chips;
  }, [filters, categories, subcategories, onChange]);

  const hasActiveFilters = activeFilters.length > 0 || filters.searchQuery;

  // Handle quick filter click
  const handleQuickFilter = useCallback((quickFilter: QuickFilter) => {
    onChange(quickFilter.getFilters());
  }, [onChange]);

  // Handle search input with debounce could be added here
  const handleSearchChange = (value: string) => {
    onChange({ searchQuery: value });
    setShowSuggestions(value.length > 0 && value.length < 20);
  };

  // Get filtered suggestions
  const filteredSuggestions = useMemo(() => {
    if (!filters.searchQuery) return [];
    return searchSuggestions
      .filter((s) => s.toLowerCase().includes(filters.searchQuery.toLowerCase()))
      .slice(0, 5);
  }, [filters.searchQuery, searchSuggestions]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Main Search Bar */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search Input */}
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={isAIMode ? "Refine AI search..." : "Search transactions..."}
              value={filters.searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => filters.searchQuery && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && onAISearch) {
                  e.preventDefault();
                  onAISearch();
                }
              }}
              style={{ paddingLeft: 40, paddingRight: filters.searchQuery ? 64 : 40, width: "100%" }}
            />

            {/* AI Sparkle Button */}
            {!isAIMode && onAISearch && filters.searchQuery && (
              <button
                onClick={onAISearch}
                style={{
                  position: "absolute",
                  right: 30,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: "4px",
                  opacity: 0.8,
                }}
                title="AI Smart Search - Press Enter"
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
              >
                ✨
              </button>
            )}

            {/* Search Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {filteredSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onChange({ searchQuery: suggestion });
                      setShowSuggestions(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: idx < filteredSuggestions.length - 1 ? "1px solid var(--border-color)" : "none",
                      cursor: "pointer",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem",
                      transition: "all var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ color: "var(--text-muted)", marginRight: 8 }}>🔍</span>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Clear Button */}
            {filters.searchQuery && (
              <button
                onClick={() => onChange({ searchQuery: "" })}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--bg-input)",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div style={{ flex: "0 0 180px" }}>
            <select
              value={filters.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value, subcategoryId: "" })}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                fontSize: "0.875rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          <div style={{ flex: "0 0 180px" }}>
            <select
              value={filters.subcategoryId}
              onChange={(e) => onChange({ subcategoryId: e.target.value })}
              disabled={!filters.categoryId}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                fontSize: "0.875rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                opacity: filters.categoryId ? 1 : 0.5,
                cursor: filters.categoryId ? "pointer" : "not-allowed",
              }}
            >
              <option value="">All Subcategories</option>
              {availableSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              padding: "0.625rem 1rem",
              background: showAdvanced ? "var(--accent)" : "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              color: showAdvanced ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={showAdvanced ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
              />
            </svg>
            Filters
            {hasActiveFilters && (
              <span
                style={{
                  background: showAdvanced ? "rgba(255,255,255,0.2)" : "var(--accent)",
                  color: "#fff",
                  fontSize: "0.75rem",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  marginLeft: "4px",
                }}
              >
                {activeFilters.length + (filters.searchQuery ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Result Stats */}
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Showing <strong>{resultCount}</strong> of <strong>{totalCount}</strong> transactions
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClear}
              style={{
                fontSize: "0.8125rem",
                color: "var(--accent)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Quick Filters */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          padding: "0 0.5rem",
        }}
      >
        {quickFilters.map((qf) => (
          <button
            key={qf.id}
            onClick={() => handleQuickFilter(qf)}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all var(--transition-fast)",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <span>{qf.icon}</span>
            {qf.label}
          </button>
        ))}
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
            padding: "0 0.5rem",
            marginTop: "-0.5rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginRight: "0.25rem" }}>
            Active:
          </span>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.375rem 0.75rem",
                background: "var(--accent-glow)",
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.8125rem",
                color: "var(--accent)",
              }}
            >
              {filter.label}
              <button
                onClick={filter.onRemove}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div
          className="card"
          style={{
            padding: "1.25rem",
            animation: "slideDown 0.2s ease-out",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Date Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Date Range
              </label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(["7d", "30d", "90d", "year", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => onChange({ dateRange: range })}
                    style={{
                      padding: "0.375rem 0.75rem",
                      background: filters.dateRange === range ? "var(--accent)" : "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: filters.dateRange === range ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                    }}
                  >
                    {range === "7d" && "7 Days"}
                    {range === "30d" && "30 Days"}
                    {range === "90d" && "90 Days"}
                    {range === "year" && "1 Year"}
                    {range === "all" && "All Time"}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              {filters.dateRange === "custom" && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => onChange({ customStartDate: e.target.value })}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "0.8125rem",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>to</span>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => onChange({ customEndDate: e.target.value })}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "0.8125rem",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Amount Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Amount Range (₹)
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => onChange({ minAmount: e.target.value })}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.8125rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                  }}
                />
                <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => onChange({ maxAmount: e.target.value })}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.8125rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Quick Amount Presets */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                {[
                  { min: "", max: "1000", label: "Under ₹1K" },
                  { min: "1000", max: "5000", label: "₹1K - ₹5K" },
                  { min: "5000", max: "20000", label: "₹5K - ₹20K" },
                  { min: "20000", max: "", label: "Over ₹20K" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() =>
                      onChange({ minAmount: preset.min, maxAmount: preset.max })
                    }
                    style={{
                      padding: "0.25rem 0.5rem",
                      background:
                        filters.minAmount === preset.min && filters.maxAmount === preset.max
                          ? "var(--accent)"
                          : "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color:
                        filters.minAmount === preset.min && filters.maxAmount === preset.max
                          ? "#fff"
                          : "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "0.6875rem",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction Type */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Transaction Type
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {([
                  { value: "all", label: "All" },
                  { value: "expense", label: "Expenses" },
                  { value: "income", label: "Income" },
                ] as const).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => onChange({ transactionType: type.value })}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      background: filters.transactionType === type.value ? "var(--accent)" : "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: filters.transactionType === type.value ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                Sort By
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select
                  value={filters.sortBy}
                  onChange={(e) => onChange({ sortBy: e.target.value as FilterState["sortBy"] })}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    fontSize: "0.8125rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="category">Category</option>
                </select>
                <button
                  onClick={() => onChange({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
                  style={{
                    padding: "0.5rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={filters.sortOrder === "asc" ? "Ascending" : "Descending"}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {filters.sortOrder === "asc" ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SmartFilters;
