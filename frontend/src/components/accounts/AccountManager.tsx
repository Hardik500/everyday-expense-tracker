import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import Select from "../ui/Select";
import { PageLoading } from "../ui/Loading";
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
  { value: "bank", label: "Bank Account", icon: "🏦", color: "#3b82f6", borderClass: "border-blue-500", bgClass: "bg-blue-500/15", textClass: "text-blue-500" },
  { value: "card", label: "Credit Card", icon: "💳", color: "#ec4899", borderClass: "border-pink-500", bgClass: "bg-pink-500/15", textClass: "text-pink-500" },
  { value: "cash", label: "Cash", icon: "💵", color: "#22c55e", borderClass: "border-green-500", bgClass: "bg-green-500/15", textClass: "text-green-500" },
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
    fetchWithAuth(`${apiBase}/accounts`)
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
      const method = editingAccount ? "PATCH" : "POST";

      const res = await fetchWithAuth(url, {
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
      const res = await fetchWithAuth(`${apiBase}/accounts/${account.id}`, {
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
    return <PageLoading text="Loading accounts..." />;
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="m-0 text-xl text-text-primary">
            Your Accounts
          </h2>
          <p className="mt-2 mb-0 text-sm text-text-muted">
            Manage bank accounts, credit cards, and cash wallets
          </p>
        </div>
        <button
          className="primary flex items-center gap-2"
          onClick={() => setShowForm(true)}
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
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
          onClick={(e) => e.target === e.currentTarget && resetForm()}
        >
          <div
            className="card w-full max-w-md max-h-[90vh] overflow-auto"
          >
            <div className="card-header">
              <h3 className="m-0">
                {editingAccount ? "Edit Account" : "New Account"}
              </h3>
              <button
                onClick={resetForm}
                className="bg-none border-none text-text-muted cursor-pointer p-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-5">
              {/* Account Name */}
              <div>
                <label className="block mb-2 text-sm text-text-secondary">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HDFC Savings, ICICI Credit Card"
                  className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-input text-text-primary text-[0.9375rem]"
                  autoFocus
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block mb-2 text-sm text-text-secondary">
                  Account Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {ACCOUNT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value as "bank" | "card" | "cash" })}
                      className="p-4 rounded-lg border-2 cursor-pointer flex flex-col items-center gap-2 transition-all"
                      style={{
                        borderColor: formData.type === type.value ? type.color : undefined,
                        background: formData.type === type.value ? `${type.color}15` : undefined,
                        color: formData.type === type.value ? type.color : undefined,
                      }}
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block mb-2 text-sm text-text-secondary">
                  Currency
                </label>
                <Select
                  value={formData.currency}
                  onChange={(val) => setFormData({ ...formData, currency: String(val) })}
                  options={[
                    { value: "INR", label: "₹ INR - Indian Rupee" },
                    { value: "USD", label: "$ USD - US Dollar" },
                    { value: "EUR", label: "€ EUR - Euro" },
                    { value: "GBP", label: "£ GBP - British Pound" },
                  ]}
                  className="w-full"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn bg-bg-input text-text-secondary border border-border-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
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
            <div className="text-5xl mb-4">🏦</div>
            <p className="font-medium mb-2">No accounts yet</p>
            <p className="text-text-muted">
              Add your first account to start tracking expenses
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {accounts.map((account) => {
            const typeInfo = getTypeInfo(account.type);
            return (
              <div
                key={account.id}
                className="card p-5"
                style={{ borderLeft: `4px solid ${typeInfo.color}` }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ background: `${typeInfo.color}20` }}
                    >
                      {typeInfo.icon}
                    </div>
                    <div>
                      <h3 className="m-0 text-base text-text-primary">
                        {account.name}
                      </h3>
                      <p className="mt-1 mb-0 text-xs text-text-muted">
                        {typeInfo.label} • {account.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(account)}
                      className="bg-none border-none text-text-muted cursor-pointer p-2 rounded transition-all hover:text-text-primary"
                      title="Edit"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      className="bg-none border-none text-text-muted cursor-pointer p-2 rounded transition-all hover:text-text-primary"
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