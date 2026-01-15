import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Category, Subcategory } from "../App";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
};

type CategoryWithStats = Category & {
  subcategories: Subcategory[];
  transactionCount?: number;
  ruleCount?: number;
  expanded?: boolean;
};

function CategoryManager({ apiBase, refreshKey, onRefresh }: Props) {
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add category modal
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Add subcategory modal
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<number | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  // Edit modal
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [editName, setEditName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/categories`);
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

      const res = await fetch(`${apiBase}/categories`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create category");
      }

      setNewCategoryName("");
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

      const res = await fetch(`${apiBase}/subcategories`, {
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

      const res = await fetch(`${apiBase}/categories/${editingCategory.id}`, {
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

  const handleEditSubcategory = async () => {
    if (!editName.trim() || !editingSubcategory) return;

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", editName.trim());

      const res = await fetch(`${apiBase}/subcategories/${editingSubcategory.id}`, {
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

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}" and all its subcategories?\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${apiBase}/categories/${cat.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete");
      }

      fetchCategories();
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleDeleteSubcategory = async (sub: Subcategory) => {
    if (!confirm(`Delete subcategory "${sub.name}"?\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${apiBase}/subcategories/${sub.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete");
      }

      fetchCategories();
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
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

                {/* Category name */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {cat.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {cat.subcategories.length} subcategories
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
                    onClick={() => handleDeleteCategory(cat)}
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
                          onClick={() => handleDeleteSubcategory(sub)}
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
    </div>
  );
}

export default CategoryManager;
