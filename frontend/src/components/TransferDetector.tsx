import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { useToast } from "./Toast";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
};

type TransferPair = {
  source: {
    id: number;
    account_name: string;
    amount: number;
    description_raw: string;
    posted_at: string;
  };
  target: {
    id: number;
    account_name: string;
    amount: number;
    description_raw: string;
    posted_at: string;
  };
  confidence: number;
  amount: number;
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
  });
};

function TransferDetector({ apiBase, refreshKey, onRefresh }: Props) {
  const [potentialTransfers, setPotentialTransfers] = useState<TransferPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<Set<string>>(new Set());
  const [autoLinking, setAutoLinking] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const { toasts, addToast, dismissToast, ToastContainer } = useToast();

  // Debounced refresh
  useEffect(() => {
    if (!needsRefresh) return;
    const timer = setTimeout(() => {
      onRefresh();
      setNeedsRefresh(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [needsRefresh, onRefresh]);

  useEffect(() => {
    if (!potentialTransfers.length) {
      setLoading(true);
    }
    fetchWithAuth(`${apiBase}/transfers/potential?days_window=14`)
      .then((res) => res.json())
      .then((data) => {
        setPotentialTransfers(data.potential_transfers || []);
        setLoading(false);
      })
      .catch(() => {
        setPotentialTransfers([]);
        setLoading(false);
      });
  }, [apiBase, refreshKey]);

  const handleLink = async (pair: TransferPair) => {
    const key = `${pair.source.id}-${pair.target.id}`;
    setLinking((prev) => new Set([...prev, key]));

    setHidden((prev) => new Set([...prev, key]));

    try {
      const res = await fetchWithAuth(
        `${apiBase}/transfers/link?source_id=${pair.source.id}&target_id=${pair.target.id}`,
        { method: "POST" }
      );
      if (res.ok) {
        setNeedsRefresh(true);
      } else {
        // Rollback if failed
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    } catch (err) {
      console.error("Link failed", err);
      // Rollback on network error
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setLinking((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleAutoLink = async () => {
    setAutoLinking(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/transfers/auto-link`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Refresh the list
        const listRes = await fetchWithAuth(`${apiBase}/transfers/potential?days_window=14`);
        const listData = await listRes.json();
        setPotentialTransfers(listData.potential_transfers || []);
        onRefresh();
        if (data.linked > 0) {
          addToast({
            type: "success",
            title: "Success",
            message: `Linked ${data.linked} transfers automatically!`,
            duration: 4000,
          });
        }
      }
    } catch (err) {
      console.error("Auto-link failed", err);
    } finally {
      setAutoLinking(false);
    }
  };

  const handleDismiss = async (pair: TransferPair) => {
    const key = `${pair.source.id}-${pair.target.id}`;
    setHidden((prev) => new Set([...prev, key]));

    try {
      await fetchWithAuth(
        `${apiBase}/transfers/ignore?source_id=${pair.source.id}&target_id=${pair.target.id}`,
        { method: "POST" }
      );
      // No refresh needed for ignore as it doesn't affect spending stats
    } catch (err) {
      console.error("Dismiss failed", err);
      // Rollback
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const visibleTransfers = potentialTransfers.filter(
    (p) => !hidden.has(`${p.source.id}-${p.target.id}`)
  );

  if (loading) {
    return null;
  }

  if (visibleTransfers.length === 0) {
    return null;
  }

  const highConfidence = visibleTransfers.filter((p) => p.confidence >= 80);

  return (
    <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(245, 158, 11, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f59e0b",
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>
              Potential Internal Transfers
            </h3>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {visibleTransfers.length} possible transfer{visibleTransfers.length !== 1 ? "s" : ""} detected
            </p>
          </div>
        </div>
        {highConfidence.length > 0 && (
          <button
            type="button"
            onClick={handleAutoLink}
            disabled={autoLinking}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8125rem",
              background: "#f59e0b",
              color: "#000",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {autoLinking ? "Linking..." : `Auto-link ${highConfidence.length} high confidence`}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {visibleTransfers.slice(0, 5).map((pair) => {
          const key = `${pair.source.id}-${pair.target.id}`;
          const isLinking = linking.has(key);

          return (
            <div
              key={key}
              style={{
                padding: "1rem",
                background: "var(--bg-input)",
                borderRadius: "var(--radius-md)",
                display: "grid",
                gap: "0.75rem",
              }}
            >
              {/* Transfer visualization */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                {/* Source (debit) */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    {pair.source.account_name} • {formatDate(pair.source.posted_at)}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {pair.source.description_raw?.slice(0, 40)}...
                  </div>
                  <div className="mono" style={{ color: "#ef4444", fontWeight: 600 }}>
                    -{formatCurrency(pair.amount)}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ color: "var(--text-muted)" }}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Target (credit) */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    {pair.target.account_name} • {formatDate(pair.target.posted_at)}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {pair.target.description_raw?.slice(0, 40)}...
                  </div>
                  <div className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
                    +{formatCurrency(pair.amount)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "var(--radius-sm)",
                    background:
                      pair.confidence >= 80
                        ? "rgba(34, 197, 94, 0.15)"
                        : pair.confidence >= 60
                          ? "rgba(251, 191, 36, 0.15)"
                          : "var(--bg-secondary)",
                    color:
                      pair.confidence >= 80
                        ? "#22c55e"
                        : pair.confidence >= 60
                          ? "#fbbf24"
                          : "var(--text-muted)",
                  }}
                >
                  {pair.confidence}% confidence
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => handleDismiss(pair)}
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.75rem",
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Not a transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLink(pair)}
                    disabled={isLinking}
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.75rem",
                      background: "var(--accent)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {isLinking ? "Linking..." : "Link as Transfer"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visibleTransfers.length > 5 && (
        <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            +{visibleTransfers.length - 5} more potential transfers
          </span>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default TransferDetector;
