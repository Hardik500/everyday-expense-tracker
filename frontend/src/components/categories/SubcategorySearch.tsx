/* eslint-disable */
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
import type { Category, Subcategory } from "../types";

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
        className={`flex items-center bg-bg-input border rounded-lg px-3 py-2 cursor-text transition-colors ${isOpen ? "border-accent" : "border-border-color"}`}
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
          className={`flex-1 bg-transparent border-none outline-none text-sm p-0 ${isOpen || displayValue ? "text-text-primary" : "text-text-muted"}`}
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={2}
          className="shrink-0 transition-transform duration-150"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
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
              className="bg-bg-card border border-border-color rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-y-auto z-[99999]"
              style={floatingStyles}
              {...getFloatingProps()}
            >
              {sortedOptions.length === 0 ? (
                <div className="px-4 py-3 text-text-muted text-sm">
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
                    className={`px-4 py-2.5 cursor-pointer border-b border-border-color flex items-center gap-2 ${activeIndex === idx ? "bg-bg-hover" : "bg-transparent"}`}
                  >
                    <span className="text-xs text-text-muted min-w-[100px]">
                      {opt.categoryName}
                    </span>
                    <span className="text-text-muted text-xs">›</span>
                    <span className="text-sm text-text-primary font-medium">
                      {opt.subcategoryName}
                    </span>
                  </div>
                ))
              )}
              {sortedOptions.length > 50 && (
                <div className="px-4 py-2 text-text-muted text-xs text-center">
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
