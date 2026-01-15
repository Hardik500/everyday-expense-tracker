import { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { Category, Subcategory } from "../App";

type Props = {
  categories: Category[];
  subcategories: Subcategory[];
  value: string; // subcategory_id as string
  onChange: (subcategoryId: string, categoryId: string) => void;
  placeholder?: string;
};

type FlatOption = {
  subcategoryId: number;
  subcategoryName: string;
  categoryId: number;
  categoryName: string;
  searchText: string;
};

function SubcategorySearch({
  categories,
  subcategories,
  value,
  onChange,
  placeholder = "Search category...",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update dropdown position when open
  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Build flat list of all options - memoized
  const options: FlatOption[] = useMemo(() => {
    return subcategories.map((sub) => {
      const cat = categories.find((c) => c.id === sub.category_id);
      return {
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        categoryId: sub.category_id,
        categoryName: cat?.name || "Unknown",
        searchText: `${cat?.name || ""} ${sub.name}`.toLowerCase(),
      };
    });
  }, [categories, subcategories]);

  // Filter and sort options based on search - memoized
  const sortedOptions = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    
    // Filter
    const filtered = searchLower
      ? options.filter((opt) =>
          opt.subcategoryName.toLowerCase().includes(searchLower) ||
          opt.categoryName.toLowerCase().includes(searchLower)
        )
      : options;
    
    // Sort: exact matches first, then alphabetically
    return [...filtered].sort((a, b) => {
      if (searchLower) {
        const aSubStart = a.subcategoryName.toLowerCase().startsWith(searchLower);
        const bSubStart = b.subcategoryName.toLowerCase().startsWith(searchLower);
        const aCatStart = a.categoryName.toLowerCase().startsWith(searchLower);
        const bCatStart = b.categoryName.toLowerCase().startsWith(searchLower);
        
        // Subcategory starts with search term comes first
        if (aSubStart && !bSubStart) return -1;
        if (!aSubStart && bSubStart) return 1;
        // Then category starts with search term
        if (aCatStart && !bCatStart) return -1;
        if (!aCatStart && bCatStart) return 1;
      }
      // Default: alphabetical by category then subcategory
      return a.categoryName.localeCompare(b.categoryName) || a.subcategoryName.localeCompare(b.subcategoryName);
    });
  }, [options, search]);

  // Get display value
  const selectedOption = options.find((opt) => String(opt.subcategoryId) === value);
  const displayValue = selectedOption
    ? `${selectedOption.categoryName} › ${selectedOption.subcategoryName}`
    : "";

  // Close on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInside = 
        containerRef.current?.contains(target) || 
        dropdownRef.current?.contains(target);
      
      if (!clickedInside) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        setHighlightedIndex((prev) => Math.min(prev + 1, sortedOptions.length - 1));
        e.preventDefault();
        break;
      case "ArrowUp":
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        e.preventDefault();
        break;
      case "Enter":
        if (sortedOptions[highlightedIndex]) {
          const opt = sortedOptions[highlightedIndex];
          onChange(String(opt.subcategoryId), String(opt.categoryId));
          setIsOpen(false);
          setSearch("");
        }
        e.preventDefault();
        break;
      case "Escape":
        setIsOpen(false);
        setSearch("");
        e.preventDefault();
        break;
    }
  };

  const handleSelect = (opt: FlatOption) => {
    onChange(String(opt.subcategoryId), String(opt.categoryId));
    setIsOpen(false);
    setSearch("");
  };

  const dropdownContent = isOpen && (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
        maxHeight: 280,
        overflowY: "auto",
        zIndex: 99999,
      }}
    >
      {sortedOptions.length === 0 ? (
        <div style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          No matching categories
        </div>
      ) : (
        sortedOptions.slice(0, 50).map((opt, idx) => (
          <div
            key={opt.subcategoryId}
            onClick={() => handleSelect(opt)}
            onMouseEnter={() => setHighlightedIndex(idx)}
            style={{
              padding: "0.625rem 1rem",
              cursor: "pointer",
              background: idx === highlightedIndex ? "var(--bg-hover)" : "transparent",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                minWidth: 100,
              }}
            >
              {opt.categoryName}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>›</span>
            <span
              style={{
                fontSize: "0.875rem",
                color: "var(--text-primary)",
                fontWeight: 500,
              }}
            >
              {opt.subcategoryName}
            </span>
          </div>
        ))
      )}
      {sortedOptions.length > 50 && (
        <div style={{ padding: "0.5rem 1rem", color: "var(--text-muted)", fontSize: "0.75rem", textAlign: "center" }}>
          +{sortedOptions.length - 50} more results...
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Input field */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--bg-input)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          padding: "0.5rem 0.75rem",
          cursor: "text",
          transition: "border-color 0.15s ease",
          borderColor: isOpen ? "var(--accent)" : "var(--border-color)",
        }}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={displayValue || placeholder}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: isOpen ? "var(--text-primary)" : displayValue ? "var(--text-primary)" : "var(--text-muted)",
            fontSize: "0.875rem",
            padding: 0,
          }}
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={2}
          style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown - rendered as portal to body */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export default SubcategorySearch;
