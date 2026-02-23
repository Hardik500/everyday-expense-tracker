import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { fetchWithAuth } from "../../utils/api";
import { StatCard } from "../dashboard/StatCard";
import { LoadingOverlay } from "../ui/Loading";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Types
interface RecurringExpense {
  id: number;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  interval_days?: number;
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  start_date: string;
  end_date?: string;
  next_due_date: string;
  previous_due_date?: string;
  is_active: boolean;
  auto_detected: boolean;
  merchant_pattern?: string;
  alert_days_before: number;
  category_name?: string;
  subcategory_name?: string;
  account_name?: string;
}

interface RecurringStats {
  total_active: number;
  upcoming_count: number;
  overdue_count: number;
  monthly_total: number;
  by_frequency: Record<string, { count: number; total: number }>;
  by_category: Array<{ category_name: string; cnt: number; total: number }>;
}

interface DetectedCandidate {
  merchant: string;
  category_id?: number;
  category_name?: string;
  occurrence_count: number;
  suggested_amount: number;
  suggested_frequency: string;
  detected_interval_days?: number;
  avg_interval_days: number;
}

// Frequency display helpers
const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom",
};

const frequencyIcons: Record<string, React.ReactNode> = {
  daily: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  weekly: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  monthly: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4h22v16H1zM5 8l3 3 3-3M5 16h14M5 12h14" />
    </svg>
  ),
  quarterly: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  yearly: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  custom: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: number, currency: string = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency === "INR" ? "INR" : currency,
  }).format(amount);
}

function formatDaysUntil(days: number): { text: string; color: string } {
  if (days < 0) return { text: `${Math.abs(days)} days overdue`, color: "var(--danger)" };
  if (days === 0) return { text: "Due today", color: "var(--warning)" };
  if (days === 1) return { text: "Due tomorrow", color: "var(--warning)" };
  if (days <= 3) return { text: `Due in ${days} days`, color: "var(--warning)" };
  return { text: `Due in ${days} days`, color: "var(--success)" };
}

export function RecurringExpenses({
  apiBase = API_BASE,
  refreshKey = 0,
  onRefresh,
}: {
  apiBase?: string;
  refreshKey?: number;
  onRefresh?: () => void;
}) {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [stats, setStats] = useState<RecurringStats | null>(null);
  const [candidates, setCandidates] = useState<DetectedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"active" | "paused" | "all">("active");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetectModal, setShowDetectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: "",
    frequency: "monthly",
    interval_days: "",
    category_id: "",
    alert_days_before: "3",
    start_date: new Date().toISOString().split("T")[0],
  });
  const [accounts, setAccounts] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [subcategories, setSubcategories] = useState<Array<{ id: number; name: string; category_id: number }>>([]);

  // Fetch data
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const [expensesRes, statsRes] = await Promise.all([
        fetchWithAuth(`${apiBase}/recurring-expenses?active_only=false`),
        fetchWithAuth(`${apiBase}/recurring-expenses/stats/summary`),
      ]);
      
      if (expensesRes.ok) {
        setExpenses(await expensesRes.json());
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      console.error("Error fetching recurring expenses:", err);
    }
    setLoading(false);
  }, [apiBase]);

  const fetchReferences = useCallback(async () => {
    try {
      const [catsRes, accsRes] = await Promise.all([
        fetchWithAuth(`${apiBase}/categories`),
        fetchWithAuth(`${apiBase}/accounts`),
      ]);
      
      if (catsRes.ok) {
        const catsData = await catsRes.json();
        setCategories(catsData.categories || []);
        setSubcategories(catsData.subcategories || []);
      }
      if (accsRes.ok) {
        setAccounts(await accsRes.json());
      }
    } catch (err) {
      console.error("Error fetching references:", err);
    }
  }, [apiBase]);

  const detectRecurring = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/recurring-expenses/detect`, {
        method: "POST",
      });
      if (res.ok) {
        setCandidates(await res.json());
        setShowDetectModal(true);
      }
    } catch (err) {
      console.error("Error detecting recurring expenses:", err);
    }
    setLoading(false);
  };

  const createRecurring = async (candidate?: DetectedCandidate) => {
    const body = candidate
      ? {
          name: candidate.merchant,
          amount: candidate.suggested_amount,
          frequency: candidate.suggested_frequency,
          category_id: candidate.category_id,
          start_date: new Date().toISOString().split("T")[0],
          alert_days_before: 3,
        }
      : {
          name: formData.name,
          description: formData.description || undefined,
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          interval_days: formData.interval_days ? parseInt(formData.interval_days) : undefined,
          category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
          start_date: formData.start_date,
          alert_days_before: parseInt(formData.alert_days_before) || 3,
        };

    try {
      const res = await fetchWithAuth(`${apiBase}/recurring-expenses`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchExpenses();
        onRefresh?.();
      }
    } catch (err) {
      console.error("Error creating recurring expense:", err);
    }
  };

  const updateRecurring = async () => {
    if (!editingExpense) return;

    try {
      const res = await fetchWithAuth(
        `${apiBase}/recurring-expenses/${editingExpense.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || undefined,
            amount: parseFloat(formData.amount),
            frequency: formData.frequency,
            interval_days: formData.interval_days
              ? parseInt(formData.interval_days)
              : undefined,
            category_id: formData.category_id
              ? parseInt(formData.category_id)
              : undefined,
            alert_days_before: parseInt(formData.alert_days_before) || 3,
          }),
        }
      );
      if (res.ok) {
        setShowEditModal(false);
        setEditingExpense(null);
        fetchExpenses();
        onRefresh?.();
      }
    } catch (err) {
      console.error("Error updating recurring expense:", err);
    }
  };

  const deleteRecurring = async (id: number) => {
    if (!confirm("Delete this recurring expense? This cannot be undone.")) return;
    try {
      const res = await fetchWithAuth(`${apiBase}/recurring-expenses/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchExpenses();
        onRefresh?.();
      }
    } catch (err) {
      console.error("Error deleting recurring expense:", err);
    }
  };

  const recordPayment = async (id: number) => {
    try {
      const res = await fetchWithAuth(
        `${apiBase}/recurring-expenses/${id}/payments/record`,
        { method: "POST" }
      );
      if (res.ok) {
        fetchExpenses();
        onRefresh?.();
      }
    } catch (err) {
      console.error("Error recording payment:", err);
    }
  };

  const toggleActive = async (expense: RecurringExpense) => {
    try {
      const res = await fetchWithAuth(
        `${apiBase}/recurring-expenses/${expense.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: !expense.is_active }),
        }
      );
      if (res.ok) {
        fetchExpenses();
        onRefresh?.();
      }
    } catch (err) {
      console.error("Error toggling expense:", err);
    }
  };

  // Edit handler
  const startEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      description: expense.description || "",
      amount: expense.amount.toString(),
      frequency: expense.frequency,
      interval_days: expense.interval_days?.toString() || "",
      category_id: expense.category_id?.toString() || "",
      alert_days_before: expense.alert_days_before.toString(),
      start_date: expense.start_date,
    });
    setShowEditModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      amount: "",
      frequency: "monthly",
      interval_days: "",
      category_id: "",
      alert_days_before: "3",
      start_date: new Date().toISOString().split("T")[0],
    });
  };

  // Effects
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshKey]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  // Filter expenses
  const filteredExpenses = expenses.filter((e) => {
    if (selectedTab === "active") return e.is_active;
    if (selectedTab === "paused") return !e.is_active;
    return true;
  });

  const activeCount = expenses.filter(e => e.is_active).length;
  const pausedCount = expenses.filter(e => !e.is_active).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedTab("active")}
            className={`px-4 py-2 rounded-lg border-none cursor-pointer font-medium transition-all ${
              selectedTab === "active"
                ? "bg-accent text-white shadow-sm"
                : "bg-bg-primary text-text-primary hover:bg-bg-hover"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setSelectedTab("paused")}
            className={`px-4 py-2 rounded-lg border-none cursor-pointer font-medium transition-all ${
              selectedTab === "paused"
                ? "bg-text-muted text-white shadow-sm"
                : "bg-bg-primary text-text-primary hover:bg-bg-hover"
            }`}
          >
            Paused ({pausedCount})
          </button>
          <button
            onClick={() => setSelectedTab("all")}
            className={`px-4 py-2 rounded-lg border-none cursor-pointer font-medium transition-all ${
              selectedTab === "all"
                ? "bg-border-color text-text-primary"
                : "bg-bg-primary text-text-secondary hover:bg-bg-hover"
            }`}
          >
            All
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={detectRecurring}
            className="px-5 py-2.5 rounded-lg border border-border-color bg-transparent text-text-primary cursor-pointer font-medium flex items-center gap-2 transition-all hover:bg-bg-hover"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            Auto-Detect
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-5 py-2.5 rounded-lg border-none bg-accent text-white cursor-pointer font-medium flex items-center gap-2 transition-all shadow-sm hover:opacity-90"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Recurring
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Active"
            value={stats.total_active}
            icon={
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            color="var(--success)"
          />
          <StatCard
            title="Monthly Total"
            value={formatCurrency(stats.monthly_total)}
            icon={
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            color="var(--accent)"
          />
          {pausedCount > 0 && (
            <StatCard
              title="Paused"
              value={pausedCount}
              icon={
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              color="var(--text-muted)"
            />
          )}
          {stats.upcoming_count > 0 && (
            <StatCard
              title="Due This Week"
              value={stats.upcoming_count}
              icon={
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              color="var(--warning)"
            />
          )}
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        {loading ? (
          <LoadingOverlay />
        ) : filteredExpenses.length === 0 ? (
          <div className="p-8 md:p-16 text-center text-text-muted">
            <svg
              width="48"
              height="48"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="mx-auto mb-4 opacity-50"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <p className="text-base font-medium mb-2">
              No recurring expenses
            </p>
            <p className="text-sm">
              Add recurring bills or subscriptions to track them automatically.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredExpenses.map((expense) => {
              const days = getDaysUntil(expense.next_due_date);
              const status = formatDaysUntil(days);
              const categoryColor =
                expense.category_name?.toLowerCase() === "food"
                  ? "#ef4444"
                  : expense.category_name?.toLowerCase() === "utilities"
                  ? "#f59e0b"
                  : expense.category_name?.toLowerCase() === "entertainment"
                  ? "#8b5cf6"
                  : expense.category_name?.toLowerCase() === "transport"
                  ? "#06b6d4"
                  : expense.category_name?.toLowerCase() === "health"
                  ? "#ec4899"
                  : expense.category_name?.toLowerCase() === "shopping"
                  ? "#14b8a6"
                  : "var(--accent)";

              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-4 p-4 md:p-5 border-b border-border-color transition-colors cursor-pointer hover:bg-bg-primary"
                >
                  {/* Frequency Icon */}
                  <div className="w-10 h-10 rounded-xl bg-bg-primary flex items-center justify-center text-text-secondary flex-shrink-0">
                    {frequencyIcons[expense.frequency] ||
                      frequencyIcons.custom}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-base text-text-primary truncate">
                        {expense.name}
                      </span>
                      {expense.auto_detected && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">
                          Auto
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-success/15 text-success">
                        {expense.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      {expense.category_name && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: categoryColor }} />
                          {expense.category_name}
                          {expense.subcategory_name &&
                            ` › ${expense.subcategory_name}`}
                        </span>
                      )}
                      <span>•</span>
                      <span>{frequencyLabels[expense.frequency]}</span>
                    </div>
                  </div>

                  {/* Amount & Status */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-base text-text-primary mb-0.5">
                      {formatCurrency(expense.amount, expense.currency)}
                    </div>
                    <div className="text-xs font-medium" style={{ color: status.color }}>
                      {status.text}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    {days <= 0 && (
                      <button
                        onClick={() => recordPayment(expense.id)}
                        className="px-3 py-2 rounded-lg border-none bg-success text-white cursor-pointer text-xs font-semibold"
                      >
                        Mark Paid
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(expense)}
                      className="p-2 rounded-lg border-none bg-bg-primary text-text-secondary cursor-pointer text-xs"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleActive(expense)}
                      title={expense.is_active ? "Pause" : "Resume"}
                      className={`p-2 rounded-lg border-none cursor-pointer text-xs ${
                        expense.is_active
                          ? "bg-warning/15 text-warning"
                          : "bg-success/15 text-success"
                      }`}
                    >
                      {expense.is_active ? (
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => deleteRecurring(expense.id)}
                      className="p-2 rounded-lg border-none bg-danger/15 text-danger cursor-pointer text-xs"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && createPortal(
        <Modal
          title="Add Recurring Expense"
          onClose={() => setShowAddModal(false)}
          footer={
            <>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2.5 rounded-md border border-border-color bg-transparent text-text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => createRecurring()}
                className="px-3 py-2.5 rounded-md border-none bg-accent text-white cursor-pointer font-medium"
              >
                Add Recurring Expense
              </button>
            </>
          }
        >
          <RecurringForm
            formData={formData}
            setFormData={setFormData}
            accounts={accounts}
            categories={categories}
            subcategories={subcategories}
          />
        </Modal>,
        document.body
      )}

      {/* Edit Modal */}
      {showEditModal && editingExpense && createPortal(
        <Modal
          title="Edit Recurring Expense"
          onClose={() => {
            setShowEditModal(false);
            setEditingExpense(null);
          }}
          footer={
            <>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingExpense(null);
                }}
                className="px-3 py-2.5 rounded-md border border-border-color bg-transparent text-text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={updateRecurring}
                className="px-3 py-2.5 rounded-md border-none bg-accent text-white cursor-pointer font-medium"
              >
                Save Changes
              </button>
            </>
          }
        >
          <RecurringForm
            formData={formData}
            setFormData={setFormData}
            accounts={accounts}
            categories={categories}
            subcategories={subcategories}
          />
        </Modal>,
        document.body
      )}

      {/* Detect Modal */}
      {showDetectModal && createPortal(
        <Modal
          title="Detected Recurring Expenses"
          onClose={() => setShowDetectModal(false)}
        >
          {candidates.length === 0 ? (
            <div
              className="p-12 text-center text-text-muted"
            >
              <svg
                width="48"
                height="48"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ marginBottom: "1rem", opacity: 0.5 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p>
                No recurring patterns detected.
                <br />
                Add more transactions to help us find patterns.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted m-0">
                Found {candidates.length} potential recurring expenses from your transaction
                history.
              </p>
              {candidates.slice(0, 10).map((c, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border border-border-color bg-bg-primary flex justify-between items-center gap-4"
                >
                  <div>
                    <div className="font-semibold mb-1">
                      {c.merchant}
                    </div>
                    <div className="text-xs text-text-muted flex gap-3 flex-wrap">
                      <span>{frequencyLabels[c.suggested_frequency]}</span>
                      {c.category_name && <span>• {c.category_name}</span>}
                      <span>
                        • {c.occurrence_count} occurrences • ~{c.avg_interval_days} days apart
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-base">
                      {formatCurrency(c.suggested_amount)}
                    </div>
                    <button
                      onClick={() => createRecurring(c)}
                      className="mt-2 px-3 py-1.5 rounded-lg border-none bg-accent text-white cursor-pointer text-xs font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
}

// Helper components
function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border-color flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-text-muted hover:text-text-primary"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-auto">{children}</div>
        {footer && (
          <div className="p-4 border-t border-border-color flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function RecurringForm({
  formData,
  setFormData,
  accounts,
  categories,
  subcategories,
}: {
  formData: Record<string, string>;
  setFormData: (data: Record<string, string>) => void;
  accounts: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  subcategories: Array<{ id: number; name: string; category_id: number }>;
}) {
  const updateField = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="e.g., Netflix, Electricity Bill"
          className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Description (optional)</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Additional details..."
          className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => updateField("amount", e.target.value)}
            placeholder="0.00"
            className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Frequency</label>
          <select
            value={formData.frequency}
            onChange={(e) => updateField("frequency", e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {formData.frequency === "custom" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Interval (days)</label>
          <input
            type="number"
            value={formData.interval_days}
            onChange={(e) => updateField("interval_days", e.target.value)}
            placeholder="e.g., 15 for every 15 days"
            className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Category</label>
          <select
            value={formData.category_id}
            onChange={(e) => {
              updateField("category_id", e.target.value);
              updateField("subcategory_id", "");
            }}
            className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Alert (days before)</label>
          <input
            type="number"
            min="0"
            max="30"
            value={formData.alert_days_before}
            onChange={(e) => updateField("alert_days_before", e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Start Date</label>
        <input
          type="date"
          value={formData.start_date}
          onChange={(e) => updateField("start_date", e.target.value)}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

export default RecurringExpenses;
