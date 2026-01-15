import { useEffect, useState } from "react";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
};

type Account = {
  id: number;
  name: string;
  type: "bank" | "card" | "cash";
  currency: string;
};

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank Account", icon: "🏦", color: "#3b82f6" },
  { value: "card", label: "Credit Card", icon: "💳", color: "#ec4899" },
  { value: "cash", label: "Cash", icon: "💵", color: "#22c55e" },
];

function AccountManager({ apiBase, refreshKey, onRefresh }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "bank" as "bank" | "card" | "cash",
    currency: "INR",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAccounts = () => {
    setLoading(true);
    fetch(`${apiBase}/accounts`)
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => {
        setAccounts([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAccounts();
  }, [apiBase, refreshKey]);

  const resetForm = () => {
    setFormData({ name: "", type: "bank", currency: "INR" });
    setEditingAccount(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      currency: account.currency,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Account name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingAccount
        ? `${apiBase}/accounts/${editingAccount.id}`
        : `${apiBase}/accounts`;
      const method = editingAccount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save account");
      }

      resetForm();
      fetchAccounts();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete "${account.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${apiBase}/accounts/${account.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete account");
      }

      fetchAccounts();
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const getTypeInfo = (type: string) => {
    return ACCOUNT_TYPES.find((t) => t.value === type) || ACCOUNT_TYPES[0];
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>
            Your Accounts
          </h2>
          <p style={{ margin: "0.5rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Manage bank accounts, credit cards, and cash wallets
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Account Form Modal */}
      {showForm && (
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
          onClick={(e) => e.target === e.currentTarget && resetForm()}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "480px",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <div className="card-header">
              <h3 style={{ margin: 0 }}>
                {editingAccount ? "Edit Account" : "New Account"}
              </h3>
              <button
                onClick={resetForm}
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

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
              {/* Account Name */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HDFC Savings, ICICI Credit Card"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                  }}
                  autoFocus
                />
              </div>

              {/* Account Type */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Account Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                  {ACCOUNT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value as "bank" | "card" | "cash" })}
                      style={{
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        border: `2px solid ${formData.type === type.value ? type.color : "var(--border-subtle)"}`,
                        background: formData.type === type.value ? `${type.color}15` : "var(--bg-input)",
                        color: formData.type === type.value ? type.color : "var(--text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.5rem",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "1.5rem" }}>{type.icon}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                  }}
                >
                  <option value="INR">₹ INR - Indian Rupee</option>
                  <option value="USD">$ USD - US Dollar</option>
                  <option value="EUR">€ EUR - Euro</option>
                  <option value="GBP">£ GBP - British Pound</option>
                </select>
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "var(--radius-md)",
                    color: "#ef4444",
                    fontSize: "0.875rem",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={resetForm}
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
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingAccount ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Cards */}
      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏦</div>
            <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>No accounts yet</p>
            <p style={{ color: "var(--text-muted)" }}>
              Add your first account to start tracking expenses
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {accounts.map((account) => {
            const typeInfo = getTypeInfo(account.type);
            return (
              <div
                key={account.id}
                className="card"
                style={{
                  padding: "1.25rem",
                  borderLeft: `4px solid ${typeInfo.color}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "var(--radius-md)",
                        background: `${typeInfo.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.5rem",
                      }}
                    >
                      {typeInfo.icon}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>
                        {account.name}
                      </h3>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        {typeInfo.label} • {account.currency}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleEdit(account)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        transition: "all 0.15s ease",
                      }}
                      title="Edit"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        transition: "all 0.15s ease",
                      }}
                      title="Delete"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AccountManager;
