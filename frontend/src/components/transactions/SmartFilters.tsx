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
import type { Category, Subcategory } from "../types";

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
    <div className="grid gap-4">
      {/* Main Search Bar */}
      <div className="card px-5 py-4">
        <div className="flex gap-4 flex-wrap items-center">
          {/* Search Input */}
          <div className="flex-[1_1_300px] relative">
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
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
              className="pl-10 pr-10 w-full"
            />

            {/* AI Sparkle Button */}
            {!isAIMode && onAISearch && filters.searchQuery && (
              <button
                onClick={onAISearch}
                className="absolute right-8 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-base p-1 opacity-80 hover:opacity-100"
                title="AI Smart Search - Press Enter"
              >
                ✨
              </button>
            )}

            {/* Search Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border-color rounded-lg shadow-lg z-[100] overflow-hidden">
                {filteredSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onChange({ searchQuery: suggestion });
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-3 text-left bg-transparent border-none border-b border-border-color last:border-b-0 cursor-pointer text-text-primary text-sm hover:bg-bg-hover transition-colors"
                  >
                    <span className="text-text-muted mr-2">🔍</span>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Clear Button */}
            {filters.searchQuery && (
              <button
                onClick={() => onChange({ searchQuery: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-bg-input border-none rounded-full w-6 h-6 flex items-center justify-center text-text-muted cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex-[0_0_180px]">
            <select
              value={filters.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value, subcategoryId: "" })}
              className="w-full px-3 py-2.5 text-sm bg-bg-input border border-border-subtle rounded-lg text-text-primary"
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
          <div className="flex-[0_0_180px]">
            <select
              value={filters.subcategoryId}
              onChange={(e) => onChange({ subcategoryId: e.target.value })}
              disabled={!filters.categoryId}
              className="w-full px-3 py-2.5 text-sm bg-bg-input border border-border-subtle rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
            className={`px-4 py-2.5 rounded-lg border cursor-pointer text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              showAdvanced
                ? "bg-accent text-white border-accent"
                : "bg-bg-input text-text-secondary border-border-subtle"
            }`}
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
              <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${showAdvanced ? "bg-white/20" : "bg-accent"} text-white`}>
                {activeFilters.length + (filters.searchQuery ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Result Stats */}
        <div className="mt-4 pt-4 border-t border-border-color flex justify-between items-center">
          <div className="text-sm text-text-muted">
            Showing <strong>{resultCount}</strong> of <strong>{totalCount}</strong> transactions
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="text-sm text-accent bg-transparent border-none cursor-pointer flex items-center gap-1"
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
      <div className="flex gap-2 flex-wrap px-2">
        {quickFilters.map((qf) => (
          <button
            key={qf.id}
            onClick={() => handleQuickFilter(qf)}
            className="px-4 py-2 bg-bg-input border border-border-subtle rounded-lg text-text-secondary cursor-pointer text-sm flex items-center gap-2 transition-colors hover:border-accent hover:text-accent whitespace-nowrap"
          >
            <span>{qf.icon}</span>
            {qf.label}
          </button>
        ))}
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center px-2 -mt-2">
          <span className="text-xs text-text-muted mr-1">
            Active:
          </span>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-glow border border-accent rounded-lg text-sm text-accent"
            >
              {filter.label}
              <button
                onClick={filter.onRemove}
                className="bg-transparent border-none text-accent cursor-pointer p-0 text-xs flex items-center opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="card p-5 animate-[slideDown_0.2s_ease-out]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Date Range
              </label>
              <div className="flex gap-2 flex-wrap">
                {(["7d", "30d", "90d", "year", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => onChange({ dateRange: range })}
                    className={`px-3 py-1.5 rounded border cursor-pointer text-xs ${
                      filters.dateRange === range
                        ? "bg-accent text-white border-accent"
                        : "bg-bg-input text-text-secondary border-border-subtle"
                    }`}
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
                <div className="flex gap-2 mt-3 items-center">
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => onChange({ customStartDate: e.target.value })}
                    className="flex-1 px-2 py-2 text-sm bg-bg-input border border-border-subtle rounded text-text-primary"
                  />
                  <span className="text-text-muted text-sm">to</span>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => onChange({ customEndDate: e.target.value })}
                    className="flex-1 px-2 py-2 text-sm bg-bg-input border border-border-subtle rounded text-text-primary"
                  />
                </div>
              )}
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Amount Range (₹)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => onChange({ minAmount: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border-subtle rounded text-text-primary"
                />
                <span className="text-text-muted text-sm">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => onChange({ maxAmount: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border-subtle rounded text-text-primary"
                />
              </div>

              {/* Quick Amount Presets */}
              <div className="flex gap-2 mt-2 flex-wrap">
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
                    className={`px-2 py-1 rounded border cursor-pointer text-[11px] ${
                      filters.minAmount === preset.min && filters.maxAmount === preset.max
                        ? "bg-accent text-white border-accent"
                        : "bg-bg-input text-text-muted border-border-subtle"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Transaction Type
              </label>
              <div className="flex gap-2">
                {([
                  { value: "all", label: "All" },
                  { value: "expense", label: "Expenses" },
                  { value: "income", label: "Income" },
                ] as const).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => onChange({ transactionType: type.value })}
                    className={`flex-1 py-2 rounded border cursor-pointer text-sm ${
                      filters.transactionType === type.value
                        ? "bg-accent text-white border-accent"
                        : "bg-bg-input text-text-secondary border-border-subtle"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Sort By
              </label>
              <div className="flex gap-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => onChange({ sortBy: e.target.value as FilterState["sortBy"] })}
                  className="flex-1 px-2 py-2 text-sm bg-bg-input border border-border-subtle rounded text-text-primary"
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="category">Category</option>
                </select>
                <button
                  onClick={() => onChange({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
                  className="px-2 py-2 bg-bg-input border border-border-subtle rounded text-text-secondary cursor-pointer flex items-center"
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