import { useEffect, useState } from "react";

type Transaction = {
  id: number;
  amount: number;
  description_raw: string;
  posted_at: string;
  account_name?: string;
  account_type?: string;
  amount_diff?: number;
};

type Link = {
  link_id: number;
  link_type: string;
  linked_at: string;
  linked_transaction_id: number;
  linked_description: string;
  linked_amount: number;
  linked_posted_at: string;
  linked_account_name: string;
};

type Props = {
  apiBase: string;
  transaction: Transaction;
  onClose: () => void;
  onLinked: () => void;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function LinkTransactionModal({ apiBase, transaction, onClose, onLinked }: Props) {
  const [existingLinks, setExistingLinks] = useState<Link[]>([]);
  const [linkableTransactions, setLinkableTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [linksRes, linkableRes] = await Promise.all([
          fetch(`${apiBase}/transactions/${transaction.id}/links`),
          fetch(`${apiBase}/transactions/${transaction.id}/linkable`),
        ]);
        
        const linksData = await linksRes.json();
        const linkableData = await linkableRes.json();
        
        setExistingLinks(linksData.links || []);
        setLinkableTransactions(linkableData.linkable || []);
      } catch (err) {
        console.error("Failed to fetch link data:", err);
        setError("Failed to load linking data");
      }
      setLoading(false);
    };

    fetchData();
  }, [apiBase, transaction.id]);

  const handleLink = async () => {
    if (!selectedId) return;
    
    setLinking(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("source_id", transaction.id.toString());
      formData.append("target_id", selectedId.toString());
      formData.append("link_type", "card_payment");
      
      const res = await fetch(`${apiBase}/transactions/link`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create link");
      }
      
      onLinked();
    } catch (err: any) {
      setError(err.message || "Failed to create link");
    }
    setLinking(false);
  };

  const handleUnlink = async (linkId: number) => {
    try {
      const res = await fetch(`${apiBase}/transactions/link/${linkId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        throw new Error("Failed to remove link");
      }
      
      // Refresh links
      const linksRes = await fetch(`${apiBase}/transactions/${transaction.id}/links`);
      const linksData = await linksRes.json();
      setExistingLinks(linksData.links || []);
      
      // Also refresh linkable
      const linkableRes = await fetch(`${apiBase}/transactions/${transaction.id}/linkable`);
      const linkableData = await linkableRes.json();
      setLinkableTransactions(linkableData.linkable || []);
    } catch (err) {
      setError("Failed to remove link");
    }
  };

  return (
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: "90%",
          maxWidth: 700,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="card-header" style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
          <div>
            <h2 style={{ margin: 0 }}>Link Transaction</h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Link credit card payments to bank statement debits
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "0.5rem",
              fontSize: "1.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
          {/* Source Transaction */}
          <div style={{ 
            padding: "1rem", 
            background: "var(--bg-input)", 
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem",
          }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Source Transaction
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-primary)" }}>
              {transaction.description_raw}
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-muted)" }}>{formatDate(transaction.posted_at)}</span>
              <span className="mono" style={{ 
                color: transaction.amount < 0 ? "var(--danger)" : "var(--success)",
                fontWeight: 600,
              }}>
                {transaction.amount < 0 ? "-" : "+"}{formatCurrency(transaction.amount)}
              </span>
              {transaction.account_name && (
                <span className="badge">{transaction.account_name}</span>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              Loading...
            </div>
          ) : (
            <>
              {/* Existing Links */}
              {existingLinks.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                    Currently Linked
                  </h3>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {existingLinks.map((link) => (
                      <div
                        key={link.link_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          padding: "0.75rem 1rem",
                          background: "var(--success)",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--success)",
                        }}
                      >
                        <svg width="20" height="20" fill="none" stroke="var(--success)" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: "0.875rem", 
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {link.linked_description}
                          </div>
                          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                            <span>{formatDate(link.linked_posted_at)}</span>
                            <span className="mono" style={{ color: link.linked_amount < 0 ? "var(--danger)" : "var(--success)" }}>
                              {link.linked_amount < 0 ? "-" : "+"}{formatCurrency(link.linked_amount)}
                            </span>
                            <span>{link.linked_account_name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnlink(link.link_id)}
                          className="ghost"
                          style={{ padding: "0.5rem", fontSize: "0.75rem" }}
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linkable Transactions */}
              {existingLinks.length === 0 && (
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                    Suggested Matches
                    <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                      (similar amount, opposite account type, within 7 days)
                    </span>
                  </h3>
                  
                  {linkableTransactions.length > 0 ? (
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      {linkableTransactions.map((tx) => (
                        <label
                          key={tx.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.75rem 1rem",
                            background: selectedId === tx.id ? "var(--accent-glow)" : "var(--bg-input)",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                            border: selectedId === tx.id ? "1px solid var(--accent)" : "1px solid transparent",
                            transition: "all var(--transition-fast)",
                          }}
                        >
                          <input
                            type="radio"
                            name="linkable"
                            checked={selectedId === tx.id}
                            onChange={() => setSelectedId(tx.id)}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontSize: "0.875rem", 
                              color: "var(--text-primary)",
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {tx.description_raw}
                            </div>
                            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                              <span>{formatDate(tx.posted_at)}</span>
                              <span className="badge" style={{ fontSize: "0.6875rem" }}>{tx.account_name}</span>
                            </div>
                          </div>
                          <div className="mono" style={{ 
                            fontSize: "0.9375rem", 
                            color: tx.amount < 0 ? "var(--danger)" : "var(--success)",
                            fontWeight: 600,
                          }}>
                            {tx.amount < 0 ? "-" : "+"}{formatCurrency(tx.amount)}
                          </div>
                          {tx.amount_diff !== undefined && tx.amount_diff === 0 && (
                            <span style={{ fontSize: "0.6875rem", color: "var(--success)", fontWeight: 500 }}>
                              Exact
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: "2rem", 
                      textAlign: "center", 
                      color: "var(--text-muted)",
                      background: "var(--bg-input)",
                      borderRadius: "var(--radius-md)",
                    }}>
                      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: "0 auto 1rem", opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <p>No matching transactions found</p>
                      <p style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                        Try importing statements from both your bank and credit card accounts
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ 
                  marginTop: "1rem",
                  padding: "0.75rem 1rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--danger)",
                  fontSize: "0.875rem",
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: "1rem 1.25rem", 
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
        }}>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          {existingLinks.length === 0 && linkableTransactions.length > 0 && (
            <button 
              className="primary" 
              onClick={handleLink}
              disabled={!selectedId || linking}
            >
              {linking ? "Linking..." : "Link Transactions"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LinkTransactionModal;
