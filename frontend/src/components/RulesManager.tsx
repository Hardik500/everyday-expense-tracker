import { useEffect, useState } from "react";
import Select from "./ui/Select";
import { Category, Subcategory } from "../App";
import SubcategorySearch from "./SubcategorySearch";

type Props = {
  apiBase: string;
  categories: Category[];
  subcategories: Subcategory[];
  refreshKey: number;
  onRefresh: () => void;
};

type Rule = {
  id: number;
  name: string;
  pattern: string;
  category_id: number | null;
  subcategory_id: number | null;
  category_name: string | null;
  subcategory_name: string | null;
  min_amount: number | null;
  max_amount: number | null;
  priority: number;
  account_type: string | null;
  merchant_contains: string | null;
  active: boolean;
};

function RulesManager({ apiBase, categories, subcategories, refreshKey, onRefresh }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRules = () => {
    setLoading(true);
    fetch(`${apiBase}/rules`)
      .then((res) => res.json())
      .then((data) => {
        setRules(data);
        setLoading(false);
      })
      .catch(() => {
        setRules([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRules();
  }, [apiBase, refreshKey]);

  const filteredRules = rules.filter((rule) => {
    if (!showInactive && !rule.active) return false;
    if (filterCategory && rule.category_id !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        rule.name.toLowerCase().includes(q) ||
        rule.pattern.toLowerCase().includes(q) ||
        rule.category_name?.toLowerCase().includes(q) ||
        rule.subcategory_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleToggle = async (rule: Rule) => {
    try {
      await fetch(`${apiBase}/rules/${rule.id}/toggle`, { method: "PATCH" });
      fetchRules();
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    try {
      await fetch(`${apiBase}/rules/${rule.id}`, { method: "DELETE" });
      fetchRules();
      onRefresh();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleSave = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      const url = editingRule.id > 0
        ? `${apiBase}/rules/${editingRule.id}`
        : `${apiBase}/rules`;
      const method = editingRule.id > 0 ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingRule.name,
          pattern: editingRule.pattern,
          category_id: editingRule.category_id,
          subcategory_id: editingRule.subcategory_id,
          min_amount: editingRule.min_amount,
          max_amount: editingRule.max_amount,
          priority: editingRule.priority,
          account_type: editingRule.account_type,
          merchant_contains: editingRule.merchant_contains,
        }),
      });
      setEditingRule(null);
      fetchRules();
      onRefresh();
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const getSubcats = (categoryId: number | null) => {
    if (!categoryId) return [];
    return subcategories.filter((s) => s.category_id === categoryId);
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>Loading rules...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Filters */}
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ flex: "1 1 250px" }}>
            <input
              type="text"
              placeholder="Search rules..."
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

          {/* Category filter */}
          <Select
            value={filterCategory || ""}
            onChange={(val) => setFilterCategory(val ? Number(val) : "")}
            options={[
              { value: "", label: "All Categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name }))
            ]}
            placeholder="Categories"
            style={{ width: 180 }}
          />

          {/* Show inactive toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Show inactive
            </span>
          </label>

          {/* Stats */}
          <div style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {filteredRules.length} of {rules.length} rules
          </div>
        </div>
      </div>

      {/* Rules table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Name</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Pattern</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Category</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center" }}>Priority</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center" }}>Active</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No rules found
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr
                    key={rule.id}
                    style={{
                      borderTop: "1px solid var(--border-subtle)",
                      opacity: rule.active ? 1 : 0.5,
                    }}
                  >
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                        {rule.name}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <code
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.5rem",
                          background: "var(--bg-input)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--accent)",
                        }}
                      >
                        {rule.pattern.length > 40 ? rule.pattern.slice(0, 40) + "..." : rule.pattern}
                      </code>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.5rem",
                          background: "rgba(139, 92, 246, 0.15)",
                          color: "#a78bfa",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        {rule.category_name || "—"}
                        {rule.subcategory_name && ` › ${rule.subcategory_name}`}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: 32,
                          padding: "0.25rem 0.5rem",
                          background: rule.priority >= 70 ? "rgba(34, 197, 94, 0.15)" : rule.priority >= 40 ? "rgba(251, 191, 36, 0.15)" : "var(--bg-input)",
                          color: rule.priority >= 70 ? "#22c55e" : rule.priority >= 40 ? "#fbbf24" : "var(--text-muted)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {rule.priority}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      <button
                        onClick={() => handleToggle(rule)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0.25rem",
                        }}
                        title={rule.active ? "Disable rule" : "Enable rule"}
                      >
                        {rule.active ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#22c55e">
                            <path d="M17 3H7a5 5 0 00-5 5v8a5 5 0 005 5h10a5 5 0 005-5V8a5 5 0 00-5-5zm0 12a4 4 0 11.001-8.001A4 4 0 0117 15z" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#6b7280">
                            <path d="M7 3h10a5 5 0 015 5v8a5 5 0 01-5 5H7a5 5 0 01-5-5V8a5 5 0 015-5zm0 12a4 4 0 100-8 4 4 0 000 8z" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setEditingRule({ ...rule })}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "0.5rem",
                          }}
                          title="Edit"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "0.5rem",
                          }}
                          title="Delete"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRule && (
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
          onClick={(e) => e.target === e.currentTarget && setEditingRule(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Edit Rule</h3>
              <button
                onClick={() => setEditingRule(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "0.5rem",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Rule Name
                </label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Pattern */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Regex Pattern
                </label>
                <input
                  type="text"
                  value={editingRule.pattern}
                  onChange={(e) => setEditingRule({ ...editingRule, pattern: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--accent)",
                    fontFamily: "monospace",
                  }}
                />
              </div>

              {/* Category & Subcategory */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Category
                </label>
                <SubcategorySearch
                  categories={categories}
                  subcategories={subcategories}
                  value={editingRule.subcategory_id ? String(editingRule.subcategory_id) : ""}
                  onChange={(subId, catId) => setEditingRule({
                    ...editingRule,
                    category_id: catId ? Number(catId) : null,
                    subcategory_id: subId ? Number(subId) : null,
                  })}
                  placeholder="Search categories..."
                />
              </div>

              {/* Priority */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Priority (0-100, higher = checked first)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Amount Range */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Min Amount (optional)
                  </label>
                  <input
                    type="number"
                    value={editingRule.min_amount ?? ""}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      min_amount: e.target.value ? Number(e.target.value) : null,
                    })}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Max Amount (optional)
                  </label>
                  <input
                    type="number"
                    value={editingRule.max_amount ?? ""}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      max_amount: e.target.value ? Number(e.target.value) : null,
                    })}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  onClick={() => setEditingRule(null)}
                  className="btn"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn btn-primary"
                  disabled={saving || !editingRule.name || !editingRule.pattern}
                >
                  {saving ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RulesManager;
