import { useState, useEffect } from "react";
import { fetchWithAuth } from "../../utils/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

type TransactionType = "expense" | "income" | "transfer";

interface FABAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  color?: string;
}

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"main" | TransactionType>("main");
  const [isAnimating, setIsAnimating] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch accounts and categories for the form
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          fetchWithAuth(`${API_BASE}/accounts`),
          fetchWithAuth(`${API_BASE}/categories`),
        ]);

        const accountsData = await accountsRes.json();
        const categoriesData = await categoriesRes.json();

        setAccounts(accountsData.accounts || []);
        setCategories(categoriesData.categories || []);

        // Set defaults
        if (accountsData.accounts?.[0]) {
          setAccountId(String(accountsData.accounts[0].id));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    if (showModal) {
      fetchData();
    }
  }, [showModal]);

  // Keyboard shortcut: 'n' for new transaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleOpenModal();
      }

      // Escape to close
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenModal = () => {
    setModalMode("main");
    setShowModal(true);
    setAmount("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setCategoryId("");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date) return;

    setIsSubmitting(true);

    try {
      // Normalize amount based on type
      let finalAmount = parseFloat(amount);
      if (modalMode === "expense" && finalAmount > 0) {
        finalAmount = -finalAmount;
      } else if (modalMode === "income" && finalAmount < 0) {
        finalAmount = Math.abs(finalAmount);
      }

      const payload = {
        account_id: parseInt(accountId) || accounts[0]?.id,
        amount: finalAmount,
        currency: "INR",
        description_raw: description,
        description_norm: description,
        posted_at: date,
        category_id: categoryId ? parseInt(categoryId) : null,
        is_manual: true,
      };

      const res = await fetchWithAuth(`${API_BASE}/transactions/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        handleCloseModal();
        // Trigger refresh - could use a global state or event
        window.dispatchEvent(new CustomEvent("transaction-added"));
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to add transaction");
      }
    } catch (error) {
      console.error("Failed to submit transaction:", error);
      alert("Failed to add transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const mainActions: FABAction[] = [
    {
      id: "expense",
      label: "Add Expense",
      shortcut: "1",
      color: "#ef4444",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
      action: () => {
        setModalMode("expense");
        setIsOpen(false);
        setShowModal(true);
      },
    },
    {
      id: "income",
      label: "Add Income",
      shortcut: "2",
      color: "#10b981",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      action: () => {
        setModalMode("income");
        setIsOpen(false);
        setShowModal(true);
      },
    },
    {
      id: "transfer",
      label: "Add Transfer",
      shortcut: "3",
      color: "#8b5cf6",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      action: () => {
        setModalMode("transfer");
        setIsOpen(false);
        setShowModal(true);
      },
    },
  ];

  const getModalTitle = () => {
    switch (modalMode) {
      case "expense":
        return "Add Expense";
      case "income":
        return "Add Income";
      case "transfer":
        return "Add Transfer";
      default:
        return "Quick Add";
    }
  };

  const getAmountPlaceholder = () => {
    switch (modalMode) {
      case "expense":
        return "Amount spent...";
      case "income":
        return "Amount received...";
      case "transfer":
        return "Amount transferred...";
      default:
        return "Amount...";
    }
  };

  const getModalAccentColor = () => {
    switch (modalMode) {
      case "expense":
        return "#ef4444";
      case "income":
        return "#10b981";
      case "transfer":
        return "#8b5cf6";
      default:
        return "var(--accent)";
    }
  };

  return (
    <>
      {/* Main FAB */}
      <div className="fixed bottom-8 right-8 z-[1000] flex flex-col items-end gap-3">
        {/* Action buttons that appear when FAB is clicked */}
        <div
          className={`flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 pointer-events-none"}`}
        >
          {mainActions.map((action, index) => (
            <div
              key={action.id}
              className={`flex items-center gap-3 transition-all ${isOpen ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0"}`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <span className="bg-bg-card text-text-primary px-3 py-2 rounded-lg text-sm font-medium border border-border-color shadow-md">
                {action.label}
                {action.shortcut && (
                  <span className="ml-2 text-text-muted text-xs">
                    {action.shortcut}
                  </span>
                )}
              </span>
              <button
                onClick={action.action}
                className="w-12 h-12 rounded-full text-white border-none cursor-pointer flex items-center justify-center transition-all hover:scale-110"
                style={{ background: action.color, boxShadow: `0 4px 14px ${action.color}40` }}
                title={action.label}
              >
                {action.icon}
              </button>
            </div>
          ))}
        </div>

        {/* Main FAB Button */}
        <button
          onClick={toggleMenu}
          className="w-14 h-14 rounded-full bg-accent text-white border-none cursor-pointer flex items-center justify-center shadow-[var(--shadow-glow)] transition-all duration-300 hover:scale-110"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
          title="Quick add transaction (press 'n')"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="transition-transform duration-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      {/* Quick Add Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001] animate-fade-in"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[1002] animate-scale-in">
            <div
              className="card p-6 rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-border-color">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: `${getModalAccentColor()}20`, color: getModalAccentColor() }}
                  >
                    {modalMode === "expense" && (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    )}
                    {modalMode === "income" && (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    {modalMode === "transfer" && (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )}
                  </div>
                  <h3 className="m-0 text-lg font-semibold">{getModalTitle()}</h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="bg-transparent border-none text-text-muted cursor-pointer p-2 rounded flex items-center justify-center hover:text-text-primary"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Transaction Type Tabs */}
              <div className="flex gap-2 mb-5">
                {(
                  [
                    { id: "expense", label: "Expense", color: "#ef4444" },
                    { id: "income", label: "Income", color: "#10b981" },
                  ] as const
                ).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setModalMode(type.id)}
                    className={`flex-1 py-2.5 px-4 rounded border-none text-sm font-medium cursor-pointer transition-all ${modalMode === type.id ? "" : "bg-bg-input text-text-secondary"}`}
                    style={{
                      background: modalMode === type.id ? `${type.color}20` : undefined,
                      color: modalMode === type.id ? type.color : undefined,
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={getAmountPlaceholder()}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        autoFocus
                        className="w-full px-4 py-2.5 pl-8 bg-bg-input border border-border-color rounded-lg text-text-primary text-lg font-semibold outline-none focus:border-accent"
                        required
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="What was this for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-bg-input border border-border-color rounded-lg text-text-primary outline-none focus:border-accent"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-bg-input border border-border-color rounded-lg text-text-primary outline-none focus:border-accent"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-bg-input border border-border-color rounded-lg text-text-primary outline-none focus:border-accent"
                    >
                      <option value="">Select category...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Account */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Account
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-bg-input border border-border-color rounded-lg text-text-primary outline-none focus:border-accent"
                      required
                    >
                      <option value="">Select account...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !amount || !description || !date || !accountId}
                  className="w-full mt-6 py-3.5 text-white border-none rounded-lg text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ background: getModalAccentColor() }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner spinner-sm" style={{ borderColor: "#fff", borderTopColor: "transparent" }} />
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Transaction
                    </>
                  )}
                </button>

                {/* Keyboard hint */}
                <p className="text-center text-xs text-text-muted mt-3">
                  Press <kbd className="font-semibold">Esc</kbd> to close
                </p>
              </form>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scale-in {
              from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
            }
          `}</style>
        </>
      )}

      {/* Keyboard hint (visible when mouse is over FAB area) */}
      {!isOpen && !showModal && (
        <div
          className="fixed bottom-20 right-8 z-[999] bg-bg-card text-text-muted px-3 py-1.5 rounded-lg text-xs border border-border-color opacity-0 translate-y-2.5 transition-all pointer-events-none fab-hint"
        >
          Press <kbd className="font-semibold">n</kbd> to add
        </div>
      )}

      <style>{`
        @media (hover: hover) {
          button[title*="Quick add"]:hover ~ .fab-hint,
          button[title*="Quick add"]:focus ~ .fab-hint {
            opacity: 1 !important;
            transform: translateY(0) !important;
          }
        }
      `}</style>
    </>
  );
}

export default FloatingActionButton;