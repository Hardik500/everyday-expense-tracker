import { useState, useRef, useEffect, useMemo } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  autoPlacement,
  useClick,
  useDismiss,
  useRole,
  useListNavigation,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react";
import type { Category, Subcategory } from "../../App";

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Floating UI setup with autoPlacement for smart positioning
  const { refs, floatingStyles, context, placement } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    middleware: [
      offset(4),
      // Use autoPlacement to automatically choose best position
      autoPlacement({
        allowedPlacements: ["bottom-start", "top-start"],
        autoAlignment: false,
      }),
      shift({ padding: 10 }),
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.min(280, availableHeight - 10)}px`,
          });
        },
        padding: 10,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context, { keyboardHandlers: false });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "listbox" });
  const listNavigation = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    listNavigation,
  ]);

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

  // Handle selection
  const handleSelect = (opt: FlatOption) => {
    onChange(String(opt.subcategoryId), String(opt.categoryId));
    setIsOpen(false);
    setSearch("");
    setActiveIndex(null);
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && activeIndex !== null && sortedOptions[activeIndex]) {
      e.preventDefault();
      handleSelect(sortedOptions[activeIndex]);
    }
  };

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(sortedOptions.length > 0 ? 0 : null);
  }, [search, sortedOptions.length]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* Reference element (input wrapper) */}
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
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
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
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

      {/* Floating dropdown */}
      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                overflowY: "auto",
                zIndex: 99999,
              }}
              {...getFloatingProps()}
            >
              {sortedOptions.length === 0 ? (
                <div style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  No matching categories
                </div>
              ) : (
                sortedOptions.slice(0, 50).map((opt, idx) => (
                  <div
                    key={opt.subcategoryId}
                    ref={(node) => { listRef.current[idx] = node; }}
                    role="option"
                    aria-selected={activeIndex === idx}
                    {...getItemProps({
                      onClick: () => handleSelect(opt),
                    })}
                    style={{
                      padding: "0.625rem 1rem",
                      cursor: "pointer",
                      background: activeIndex === idx ? "var(--bg-hover)" : "transparent",
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
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

export default SubcategorySearch;
