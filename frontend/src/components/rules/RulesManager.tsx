import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import ReactDOM from "react-dom";
import Select from "../ui/Select";
import { Category, Subcategory } from "../types";
import SubcategorySearch from "../categories/SubcategorySearch";
import { PageLoading } from "../ui/Loading";

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

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="relative w-11 h-6 rounded-full border-none cursor-pointer transition-colors shrink-0"
    style={{ background: checked ? "var(--accent)" : "var(--bg-secondary)" }}
  >
    <span
      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
      style={{ left: checked ? "22px" : "2px" }}
    />
  </button>
);

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
    fetchWithAuth(`${apiBase}/rules`)
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
    // Exclusively show active or inactive based on toggle
    if (Boolean(rule.active) === showInactive) return false;
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
      await fetchWithAuth(`${apiBase}/rules/${rule.id}/toggle`, { method: "PATCH" });
      fetchRules();
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    try {
      await fetchWithAuth(`${apiBase}/rules/${rule.id}`, { method: "DELETE" });
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
      await fetchWithAuth(url, {
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
    return <PageLoading text="Loading rules..." />;
  }

  return (
    <div className="grid gap-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-4 flex-wrap items-center">
          {/* Search */}
          <div className="flex-[1_1_250px]">
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border-subtle bg-bg-input text-text-primary text-sm"
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
            className="w-[180px]"
          />

          {/* Show inactive toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">
              {showInactive ? "Inactive rules" : "Active rules"}
            </span>
            <Toggle checked={showInactive} onChange={setShowInactive} />
          </div>

          {/* Stats */}
          <div className="ml-auto text-sm text-text-muted">
            {filteredRules.length} of {rules.length} rules
          </div>
        </div>
      </div>

      {/* Rules table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg-secondary text-left">
                <th className="px-4 py-3 font-medium text-xs text-text-muted">Name</th>
                <th className="px-4 py-3 font-medium text-xs text-text-muted">Pattern</th>
                <th className="px-4 py-3 font-medium text-xs text-text-muted">Category</th>
                <th className="px-4 py-3 font-medium text-xs text-text-muted text-center">Priority</th>
                <th className="px-4 py-3 font-medium text-xs text-text-muted text-center">Active</th>
                <th className="px-4 py-3 font-medium text-xs text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text-muted">
                    No rules found
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-t border-border-subtle"
                    style={{ opacity: rule.active ? 1 : 0.5 }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-text-primary">
                        {rule.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs px-2 py-1 bg-bg-input rounded text-accent">
                        {rule.pattern.length > 40 ? rule.pattern.slice(0, 40) + "..." : rule.pattern}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 bg-purple-500/15 text-purple-400 rounded text-xs font-medium">
                        {rule.category_name || "—"}
                        {rule.subcategory_name && ` › ${rule.subcategory_name}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block min-w-[32px] px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          background: rule.priority >= 70 ? "rgba(34, 197, 94, 0.15)" : rule.priority >= 40 ? "rgba(251, 191, 36, 0.15)" : "var(--bg-input)",
                          color: rule.priority >= 70 ? "#22c55e" : rule.priority >= 40 ? "#fbbf24" : "var(--text-muted)",
                        }}
                      >
                        {rule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(rule)}
                        className="bg-none border-none cursor-pointer p-1"
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingRule({ ...rule })}
                          className="bg-none border-none text-text-muted cursor-pointer p-2"
                          title="Edit"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="bg-none border-none text-text-muted cursor-pointer p-2"
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
      {editingRule && ReactDOM.createPortal(
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]"
          onClick={(e) => e.target === e.currentTarget && setEditingRule(null)}
        >
          <div
            className="card w-full max-w-[560px] max-h-[90vh] overflow-auto animate-[slideUp_0.2s_ease]"
          >
            <div className="card-header">
              <h3 className="m-0">Edit Rule</h3>
              <button
                onClick={() => setEditingRule(null)}
                className="bg-none border-none text-text-muted cursor-pointer p-2"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4">
              {/* Name */}
              <div>
                <label className="block mb-2 text-sm text-text-secondary">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-input text-text-primary"
                />
              </div>

              {/* Pattern */}
              <div>
                <label className="block mb-2 text-sm text-text-secondary">
                  Regex Pattern
                </label>
                <input
                  type="text"
                  value={editingRule.pattern}
                  onChange={(e) => setEditingRule({ ...editingRule, pattern: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-input text-accent font-mono"
                />
              </div>

              {/* Category & Subcategory */}
              <div>
                <label className="block mb-2 text-sm text-text-secondary">
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
                <label className="block mb-2 text-sm text-text-secondary">
                  Priority (0-100, higher = checked first)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-input text-text-primary"
                />
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm text-text-secondary">
                    Min Amount (optional)
                  </label>
                  <input
                    type="number"
                    value={editingRule.min_amount ?? ""}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      min_amount: e.target.value ? Number(e.target.value) : null,
                    })}
                    className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-input text-text-primary"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm text-text-secondary">
                    Max Amount (optional)
                  </label>
                  <input
                    type="number"
                    value={editingRule.max_amount ?? ""}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      max_amount: e.target.value ? Number(e.target.value) : null,
                    })}
                    className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-input text-text-primary"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end mt-2">
                <button
                  onClick={() => setEditingRule(null)}
                  className="btn bg-bg-input text-text-secondary border border-border-subtle"
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
        </div>,
        document.body
      )}
    </div>
  );
}

export default RulesManager;