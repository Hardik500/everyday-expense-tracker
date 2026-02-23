import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";

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
          fetchWithAuth(`${apiBase}/transactions/${transaction.id}/links`),
          fetchWithAuth(`${apiBase}/transactions/${transaction.id}/linkable`),
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

      const res = await fetchWithAuth(`${apiBase}/transactions/link`, {
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
      const res = await fetchWithAuth(`${apiBase}/transactions/link/${linkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove link");
      }

      // Refresh links
      const linksRes = await fetchWithAuth(`${apiBase}/transactions/${transaction.id}/links`);
      const linksData = await linksRes.json();
      setExistingLinks(linksData.links || []);

      // Also refresh linkable
      const linkableRes = await fetchWithAuth(`${apiBase}/transactions/${transaction.id}/linkable`);
      const linkableData = await linkableRes.json();
      setLinkableTransactions(linkableData.linkable || []);
    } catch (err) {
      setError("Failed to remove link");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card w-[90%] max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="card-header px-5 py-5 border-b border-border-color">
          <div>
            <h2 className="m-0">Link Transaction</h2>
            <p className="mt-1 mb-0 text-sm text-text-muted">
              Link credit card payments to bank statement debits
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-text-muted cursor-pointer p-2 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {/* Source Transaction */}
          <div className="p-4 bg-bg-input rounded-lg mb-6">
            <div className="text-xs text-text-muted mb-2">
              Source Transaction
            </div>
            <div className="text-[0.9375rem] font-medium text-text-primary">
              {transaction.description_raw}
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-text-muted">{formatDate(transaction.posted_at)}</span>
              <span className={`mono font-semibold ${transaction.amount < 0 ? "text-danger" : "text-success"}`}>
                {transaction.amount < 0 ? "-" : "+"}{formatCurrency(transaction.amount)}
              </span>
              {transaction.account_name && (
                <span className="badge">{transaction.account_name}</span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-text-muted">
              Loading...
            </div>
          ) : (
            <>
              {/* Existing Links */}
              {existingLinks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[0.9375rem] font-semibold mb-3 text-text-primary">
                    Currently Linked
                  </h3>
                  <div className="grid gap-2">
                    {existingLinks.map((link) => (
                      <div
                        key={link.link_id}
                        className="flex items-center gap-4 px-4 py-3 bg-emerald-500/10 rounded-lg border border-emerald-500"
                      >
                        <svg width="20" height="20" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                            {link.linked_description}
                          </div>
                          <div className="flex gap-3 text-xs text-text-muted mt-1">
                            <span>{formatDate(link.linked_posted_at)}</span>
                            <span className={`mono ${link.linked_amount < 0 ? "text-danger" : "text-success"}`}>
                              {link.linked_amount < 0 ? "-" : "+"}{formatCurrency(link.linked_amount)}
                            </span>
                            <span>{link.linked_account_name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnlink(link.link_id)}
                          className="ghost p-2 text-xs"
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
                  <h3 className="text-[0.9375rem] font-semibold mb-3 text-text-primary">
                    Suggested Matches
                    <span className="font-normal text-sm text-text-muted ml-2">
                      (similar amount, opposite account type, within 7 days)
                    </span>
                  </h3>

                  {linkableTransactions.length > 0 ? (
                    <div className="grid gap-2">
                      {linkableTransactions.map((tx) => (
                        <label
                          key={tx.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer border transition-all ${
                            selectedId === tx.id
                              ? "bg-accent-glow border-accent"
                              : "bg-bg-input border-transparent"
                          }`}
                        >
                          <input
                            type="radio"
                            name="linkable"
                            checked={selectedId === tx.id}
                            onChange={() => setSelectedId(tx.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                              {tx.description_raw}
                            </div>
                            <div className="flex gap-3 text-xs text-text-muted mt-1">
                              <span>{formatDate(tx.posted_at)}</span>
                              <span className="badge text-[11px]">{tx.account_name}</span>
                            </div>
                          </div>
                          <div className={`mono text-[0.9375rem] font-semibold ${tx.amount < 0 ? "text-danger" : "text-success"}`}>
                            {tx.amount < 0 ? "-" : "+"}{formatCurrency(tx.amount)}
                          </div>
                          {tx.amount_diff !== undefined && tx.amount_diff === 0 && (
                            <span className="text-[11px] text-success font-medium">
                              Exact
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-text-muted bg-bg-input rounded-lg">
                      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="mx-auto mb-4 opacity-50">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <p>No matching transactions found</p>
                      <p className="text-sm mt-2">
                        Try importing statements from both your bank and credit card accounts
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 px-4 py-3 bg-red-500/10 border border-danger rounded-lg text-danger text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-color flex justify-end gap-3">
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