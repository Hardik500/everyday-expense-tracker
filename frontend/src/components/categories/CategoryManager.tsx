import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import { createPortal } from "react-dom";
import type { Category, Subcategory } from "../types";
import { PageLoading } from "../ui/Loading";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
  onViewTransactions?: (filter: { categoryId?: number; subcategoryId?: number }) => void;
};

// --- Custom Modal for Deletion Confirmation ---
type DeleteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isDeleting: boolean;
  error?: string | null;
  linkedTransactionAction?: () => void;
};

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isDeleting,
  error,
  linkedTransactionAction,
}: DeleteModalProps) => {
  if (!isOpen) return null;

  return createPortal(
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
      onClick={onClose}
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
        <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", whiteSpace: "pre-wrap" }}>
          {message}
        </p>

        {error && (
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
            {error}
            {linkedTransactionAction && (error.includes("transaction") || error.includes("linked")) && (
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  onClick={linkedTransactionAction}
                  style={{
                    background: "var(--danger)",
                    color: "white",
                    border: "none",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  View Transactions
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button className="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            className="danger"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Popular Lucide icons for categories
const CATEGORY_ICONS = [
  { name: "shopping-bag", path: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" },
  { name: "utensils", path: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M3 2h6M3 2v20M12 2v10c0 4.4 3.6 8 8 8h4V2h-4c-4.4 0-8 3.6-8 8z" },
  { name: "car", path: "M14 16H9m10 0h3v-3.15a1 1 0 00-.8-.76l-2.1-.42a1 1 0 01-.93-.54L17.35 8H5.64l-.86 3.29a1 1 0 01-.93.54l-2.1.42a1 1 0 00-.8.76V16h3m12-4h-5M2 16h.01M2 12h.01M19 7a4 4 0 10-8 0 4 4 0 008 0z" },
  { name: "home", path: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10" },
  { name: "zap", path: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { name: "wifi", path: "M5 12.55a11 11 0 0114.08 0M4.26 10.03a15.5 15.5 0 0122.48 0M1.42 13.8a19.5 19.5 0 0133.16 0M12 18h.01" },
  { name: "smartphone", path: "M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01" },
  { name: "tv", path: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM8 22v-4M16 22v-4M12 2v4" },
  { name: "heart", path: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" },
  { name: "gift", path: "M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" },
  { name: "briefcase", path: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 13v4" },
  { name: "plane", path: "M2 12h20M13 2v20M21 12a9 9 0 01-9 9M3 12a9 9 0 019-9" },
  { name: "book-open", path: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" },
  { name: "gamepad-2", path: "M6 11h4M8 9v4M15 12h.01M18 10h.01M17.32 5H6.68a4 4 0 00-3.978 3.59c-.019.154-.03.31-.03.468v7.884c0 .157.011.314.03.468A4 4 0 006.68 21h10.64a4 4 0 003.978-3.59c.019-.154.03-.31.03-.468v-7.884c0-.157-.011-.314-.03-.468A4 4 0 0017.32 5z" },
  { name: "coffee", path: "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" },
  { name: "music", path: "M9 18V5l12-2v13" },
  { name: "film", path: "M7 4v16M17 4v16M2 9h20M2 15h20M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { name: "credit-card", path: "M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22" },
  { name: "banknote", path: "M4 10h3l4-5 4 5h7M4 14h16M1 4h22v16H1z" },
  { name: "trending-up", path: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" },
  { name: "shield", path: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { name: "pill", path: "M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM14.5 9l5.5 5.5" },
  { name: "dumbbell", path: "M6.5 6.5h11M6.5 17.5h11M6 20L2 16l4-4M18 20l4-4-4-4M12 5v14" },
  { name: "graduation-cap", path: "M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" },
  { name: "shopping-cart", path: "M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" },
  { name: "package", path: "M11 21.73a2 2 0 002 2l7.5-4.37a2 2 0 001-1.73V6.27a2 2 0 00-1-1.73L13 1a2 2 0 00-2 0l-7.5 4.37a2 2 0 00-1 1.73v9.63a2 2 0 001 1.73L3 18l6 3M8 6v14" },
  { name: "truck", path: "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM10 18a3 3 0 100-6 3 3 0 000 6zM20 18a3 3 0 100-6 3 3 0 000 6z" },
  { name: "building", path: "M3 21h18M5 21V7l8-4 8 4v14M8 21V10h2v11M14 21v-5h2v5" },
  { name: "leaf", path: "M11 20A7 7 0 019.1 6.36 15.6 15.6 0 0020 18 15.56 15.56 0 0011 20zM7 20a9.44 9.44 0 0011-11.74A9.47 9.47 0 007 20z" },
  { name: "sun", path: "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 6a6 6 0 100 12 6 6 0 000-12z" },
];

// Helper to get icon path
const getIconPath = (iconName: string | null | undefined): string => {
  if (!iconName) return "";
  const icon = CATEGORY_ICONS.find(i => i.name === iconName);
  return icon?.path || "";
};

type CategoryWithStats = Category & {
  subcategories: Subcategory[];
  transactionCount?: number;
  ruleCount?: number;
  expanded?: boolean;
};

function CategoryManager({ apiBase, refreshKey, onRefresh, onViewTransactions }: Props) {
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add category modal
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");
  const [newCategoryIcon, setNewCategoryIcon] = useState<string>("shopping-bag");

  // Predefined color palette
  const colorPalette = [
    "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981", "#06B6D4",
    "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E", "#64748B",
  ];

  // Add subcategory modal
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<number | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  // Edit modal
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [editName, setEditName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    type: "category" | "subcategory";
    id: number;
    name: string;
    categoryId?: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/categories`);
      const data = await res.json();

      // Group subcategories by category
      const cats: CategoryWithStats[] = (data.categories || []).map((cat: Category) => ({
        ...cat,
        subcategories: (data.subcategories || []).filter(
          (sub: Subcategory) => sub.category_id === cat.id
        ),
        expanded: false,
      }));

      setCategories(cats);
    } catch (err) {
      setCategories([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, [apiBase, refreshKey]);

  const filteredCategories = categories.filter((cat) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (cat.name.toLowerCase().includes(q)) return true;
    return cat.subcategories.some((sub) => sub.name.toLowerCase().includes(q));
  });

  const toggleExpand = (catId: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, expanded: !c.expanded } : c))
    );
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError("Category name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", newCategoryName.trim());
      formData.append("color", newCategoryColor);
      formData.append("icon", newCategoryIcon);

      const res = await fetchWithAuth(`${apiBase}/categories`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create category");
      }

      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setNewCategoryIcon("shopping-bag");
      setShowAddCategory(false);
      fetchCategories();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
    setSaving(false);
  };

  const handleAddSubcategory = async () => {
    if (!newSubcategoryName.trim() || !addingSubcategoryTo) {
      setError("Subcategory name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("category_id", addingSubcategoryTo.toString());
      formData.append("name", newSubcategoryName.trim());

      const res = await fetchWithAuth(`${apiBase}/subcategories`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create subcategory");
      }

      setNewSubcategoryName("");
      setAddingSubcategoryTo(null);
      fetchCategories();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
    setSaving(false);
  };

  const handleEditCategory = async () => {
    if (!editName.trim() || !editingCategory) return;

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", editName.trim());
      formData.append("color", editingCategory.color || "");
      formData.append("monthly_budget", String(editingCategory.monthly_budget || ""));
      formData.append("icon", editingCategory.icon || "");

      const res = await fetchWithAuth(`${apiBase}/categories/${editingCategory.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to update");
      }

      setEditingCategory(null);
      setEditName("");
      fetchCategories();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
    setSaving(false);
  };

  const handleCategoryColorChange = (categoryId: number, color: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, color } : c))
    );
  };

  const handleEditSubcategory = async () => {
    if (!editName.trim() || !editingSubcategory) return;

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", editName.trim());

      const res = await fetchWithAuth(`${apiBase}/subcategories/${editingSubcategory.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to update");
      }

      setEditingSubcategory(null);
      setEditName("");
      fetchCategories();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
    setSaving(false);
  };

  const confirmDeleteCategory = (cat: Category) => {
    setDeleteItem({ type: "category", id: cat.id, name: cat.name });
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const confirmDeleteSubcategory = (sub: Subcategory) => {
    setDeleteItem({
      type: "subcategory",
      id: sub.id,
      name: sub.name,
      categoryId: sub.category_id
    });
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const endpoint = deleteItem.type === "category" ? "categories" : "subcategories";
      const res = await fetchWithAuth(`${apiBase}/${endpoint}/${deleteItem.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete");
      }

      setDeleteModalOpen(false);
      fetchCategories();
      onRefresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewTransactions = () => {
    if (onViewTransactions && deleteItem) {
      if (deleteItem.type === "category") {
        onViewTransactions({ categoryId: deleteItem.id });
      } else if (deleteItem.type === "subcategory" && deleteItem.categoryId) {
        onViewTransactions({ categoryId: deleteItem.categoryId, subcategoryId: deleteItem.id });
      }
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return <PageLoading text="Loading categories..." />;
  }

  const totalSubcategories = categories.reduce((sum, c) => sum + c.subcategories.length, 0);

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Header with stats */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ flex: "1 1 300px" }}>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.625rem 1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Stats */}
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {categories.length} categories • {totalSubcategories} subcategories
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowAddCategory(true)}
            className="primary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Category
          </button>
        </div>
      </div>

      {/* Categories list */}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {filteredCategories.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>No categories found</p>
              <p style={{ color: "var(--text-muted)" }}>
                {searchQuery ? "Try a different search" : "Add your first category"}
              </p>
            </div>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Category header */}
              <div
                style={{
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  cursor: "pointer",
                  background: cat.expanded ? "var(--bg-secondary)" : "transparent",
                }}
                onClick={() => toggleExpand(cat.id)}
              >
                {/* Expand icon */}
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{
                    transform: cat.expanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                    color: "var(--text-muted)",
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>

                {/* Category name with color dot and icon */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Feature 9: Category Icon */}
                  {cat.icon && getIconPath(cat.icon) ? (
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke={cat.color || "var(--text-primary)"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      style={{ flexShrink: 0 }}
                    >
                      <path d={getIconPath(cat.icon)} />
                    </svg>
                  ) : cat.color ? (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: cat.color,
                        flexShrink: 0,
                      }}
                      title={cat.color}
                    />
                  ) : null}
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {cat.subcategories.length} subcategories
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{ display: "flex", gap: "0.5rem" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setAddingSubcategoryTo(cat.id);
                      setNewSubcategoryName("");
                      setError("");
                    }}
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Sub
                  </button>
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setEditName(cat.name);
                      setError("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0.375rem",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    title="Edit"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => confirmDeleteCategory(cat)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0.375rem",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    title="Delete"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Subcategories */}
              {cat.expanded && cat.subcategories.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  {cat.subcategories.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        padding: "0.75rem 1.25rem 0.75rem 3rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          opacity: 0.5,
                        }}
                      />
                      <div style={{ flex: 1, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        {sub.name}
                      </div>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          onClick={() => {
                            setEditingSubcategory(sub);
                            setEditName(sub.name);
                            setError("");
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0.25rem",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                          }}
                          title="Edit"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => confirmDeleteSubcategory(sub)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0.25rem",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                          }}
                          title="Delete"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cat.expanded && cat.subcategories.length === 0 && (
                <div
                  style={{
                    padding: "1rem 1.25rem 1rem 3rem",
                    borderTop: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    fontSize: "0.875rem",
                    fontStyle: "italic",
                  }}
                >
                  No subcategories yet
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCategory && createPortal(
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
          onClick={(e) => e.target === e.currentTarget && setShowAddCategory(false)}
        >
          <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>New Category</h3>
              <button
                onClick={() => setShowAddCategory(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Subscriptions, Gifts"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category Color
                </label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: color,
                        border: newCategoryColor === color ? "3px solid var(--text-primary)" : "2px solid transparent",
                        cursor: "pointer",
                        boxShadow: newCategoryColor === color ? "0 0 0 2px var(--accent)" : "none",
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Feature 9: Icon Picker */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category Icon (optional)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem", maxHeight: "150px", overflowY: "auto", padding: "0.5rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <button
                    onClick={() => setNewCategoryIcon("")}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      background: newCategoryIcon === "" ? "var(--accent)" : "transparent",
                      border: newCategoryIcon === "" ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px",
                      fontSize: "0.75rem",
                      color: newCategoryIcon === "" ? "#fff" : "var(--text-muted)",
                    }}
                    title="No icon"
                  >
                    ∅
                  </button>
                  {CATEGORY_ICONS.map((icon) => (
                    <button
                      key={icon.name}
                      onClick={() => setNewCategoryIcon(icon.name)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-md)",
                        background: newCategoryIcon === icon.name ? "var(--accent)" : "transparent",
                        border: newCategoryIcon === icon.name ? "2px solid var(--accent)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px",
                      }}
                      title={icon.name}
                    >
                      <svg width="18" height="18" fill="none" stroke={newCategoryIcon === icon.name ? "#fff" : "var(--text-secondary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d={icon.path} />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowAddCategory(false)}
                  style={{ padding: "0.5rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCategory}
                  disabled={saving}
                  className="primary"
                >
                  {saving ? "Creating..." : "Create Category"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Subcategory Modal */}
      {addingSubcategoryTo && createPortal(
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
          onClick={(e) => e.target === e.currentTarget && setAddingSubcategoryTo(null)}
        >
          <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>New Subcategory</h3>
              <button
                onClick={() => setAddingSubcategoryTo(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                Adding to: <strong style={{ color: "var(--text-primary)" }}>
                  {categories.find((c) => c.id === addingSubcategoryTo)?.name}
                </strong>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Subcategory Name
                </label>
                <input
                  type="text"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="e.g., Netflix, Prime Video"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubcategory()}
                />
              </div>

              {error && (
                <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setAddingSubcategoryTo(null)}
                  style={{ padding: "0.5rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSubcategory}
                  disabled={saving}
                  className="primary"
                >
                  {saving ? "Creating..." : "Create Subcategory"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Category Modal */}
      {editingCategory && createPortal(
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
          onClick={(e) => e.target === e.currentTarget && setEditingCategory(null)}
        >
          <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Edit Category</h3>
              <button
                onClick={() => setEditingCategory(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleEditCategory()}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category Color
                </label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleCategoryColorChange(editingCategory.id, color)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: color,
                        border: editingCategory?.color === color ? "3px solid var(--text-primary)" : "2px solid transparent",
                        cursor: "pointer",
                        boxShadow: editingCategory?.color === color ? "0 0 0 2px var(--accent)" : "none",
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Feature 9: Icon Picker in Edit Modal */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category Icon
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem", maxHeight: "120px", overflowY: "auto", padding: "0.5rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <button
                    onClick={() => setEditingCategory({ ...editingCategory, icon: "" })}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-md)",
                      background: editingCategory?.icon === "" || !editingCategory?.icon ? "var(--accent)" : "transparent",
                      border: editingCategory?.icon === "" || !editingCategory?.icon ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                      fontSize: "0.625rem",
                      color: editingCategory?.icon === "" || !editingCategory?.icon ? "#fff" : "var(--text-muted)",
                    }}
                    title="No icon"
                  >
                    ∅
                  </button>
                  {CATEGORY_ICONS.map((icon) => (
                    <button
                      key={icon.name}
                      onClick={() => setEditingCategory({ ...editingCategory, icon: icon.name })}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-md)",
                        background: editingCategory?.icon === icon.name ? "var(--accent)" : "transparent",
                        border: editingCategory?.icon === icon.name ? "2px solid var(--accent)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "4px",
                      }}
                      title={icon.name}
                    >
                      <svg width="16" height="16" fill="none" stroke={editingCategory?.icon === icon.name ? "#fff" : "var(--text-secondary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d={icon.path} />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Monthly Budget (₹)
                </label>
                <input
                  type="number"
                  value={editingCategory?.monthly_budget || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, monthly_budget: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="e.g., 5000"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                />
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Set a monthly spending limit for this category
                </div>
              </div>

              {error && (
                <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingCategory(null)}
                  style={{ padding: "0.5rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditCategory}
                  disabled={saving}
                  className="primary"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Subcategory Modal */}
      {editingSubcategory && createPortal(
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
          onClick={(e) => e.target === e.currentTarget && setEditingSubcategory(null)}
        >
          <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Edit Subcategory</h3>
              <button
                onClick={() => setEditingSubcategory(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Subcategory Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleEditSubcategory()}
                />
              </div>

              {error && (
                <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingSubcategory(null)}
                  style={{ padding: "0.5rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubcategory}
                  disabled={saving}
                  className="primary"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Use generic DeleteConfirmationModal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={executeDelete}
        title={`Delete ${deleteItem?.type === "category" ? "Category" : "Subcategory"}`}
        message={`Are you sure you want to delete "${deleteItem?.name}"?\n\nThis cannot be undone.`}
        isDeleting={isDeleting}
        error={deleteError}
        linkedTransactionAction={onViewTransactions ? handleViewTransactions : undefined}
      />
    </div>
  );
}

export default CategoryManager;
