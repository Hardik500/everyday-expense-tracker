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
      <div
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.75rem",
        }}
      >
        {/* Action buttons that appear when FAB is clicked */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.75rem",
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? "translateY(0)" : "translateY(20px)",
            pointerEvents: isOpen ? "auto" : "none",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {mainActions.map((action, index) => (
            <div
              key={action.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                transform: isOpen ? "translateX(0)" : "translateX(20px)",
                opacity: isOpen ? 1 : 0,
                transition: `all 0.2s ease ${index * 0.05}s`,
              }}
            >
              <span
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                {action.label}
                {action.shortcut && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                    }}
                  >
                    {action.shortcut}
                  </span>
                )}
              </span>
              <button
                onClick={action.action}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: action.color,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 4px 14px ${action.color}40`,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
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
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-glow)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow = "0 0 30px var(--accent-glow)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "var(--shadow-glow)";
            }
          }}
          title="Quick add transaction (press 'n')"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{
              transition: "transform 0.3s ease",
            }}
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
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 1001,
              animation: "fadeIn 0.2s ease",
            }}
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "100%",
              maxWidth: 480,
              zIndex: 1002,
              animation: "scaleIn 0.2s ease",
            }}
          >
            <div
              className="card"
              style={{
                padding: "1.5rem",
                borderRadius: "var(--radius-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1.25rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${getModalAccentColor()}20`,
                      color: getModalAccentColor(),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
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
                  <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>{getModalTitle()}</h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "0.5rem",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Transaction Type Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "1.25rem",
                }}
              >
                {(
                  [
                    { id: "expense", label: "Expense", color: "#ef4444" },
                    { id: "income", label: "Income", color: "#10b981" },
                  ] as const
                ).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setModalMode(type.id)}
                    style={{
                      flex: 1,
                      padding: "0.625rem 1rem",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: modalMode === type.id ? `${type.color}20` : "var(--bg-input)",
                      color: modalMode === type.id ? type.color : "var(--text-secondary)",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Amount */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      Amount
                    </label>
                    <div style={{ position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: "1rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={getAmountPlaceholder()}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        autoFocus
                        style={{
                          paddingLeft: "2rem",
                          fontSize: "1.125rem",
                          fontWeight: 600,
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="What was this for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      Date
                    </label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>

                  {/* Category */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      style={{
                        backgroundColor: "var(--bg-input)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.625rem 0.875rem",
                        color: "var(--text-primary)",
                        width: "100%",
                      }}
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
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      Account
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      style={{
                        backgroundColor: "var(--bg-input)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.625rem 0.875rem",
                        color: "var(--text-primary)",
                        width: "100%",
                      }}
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
                  style={{
                    width: "100%",
                    marginTop: "1.5rem",
                    padding: "0.875rem",
                    background: getModalAccentColor(),
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
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
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: "0.75rem",
                  }}
                >
                  Press <kbd>Esc</kbd> to close
                </p>
              </form>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
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
          style={{
            position: "fixed",
            bottom: "5rem",
            right: "2rem",
            zIndex: 999,
            background: "var(--bg-card)",
            color: "var(--text-muted)",
            padding: "0.375rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            border: "1px solid var(--border-color)",
            opacity: 0,
            transform: "translateY(10px)",
            transition: "all 0.2s ease",
            pointerEvents: "none",
          }}
          className="fab-hint"
        >
          Press <kbd style={{ fontWeight: 600 }}>n</kbd> to add
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
