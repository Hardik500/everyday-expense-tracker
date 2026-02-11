import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { createPortal } from "react-dom";
import type { Category, Subcategory } from "../App";
import { PageLoading } from "./ui/Loading";

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
            className="btn btn-primary"
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

                {/* Category name with color dot */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {cat.color && (
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
                  )}
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
                  className="btn btn-primary"
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
                  className="btn btn-primary"
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
                  className="btn btn-primary"
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
                  className="btn btn-primary"
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
