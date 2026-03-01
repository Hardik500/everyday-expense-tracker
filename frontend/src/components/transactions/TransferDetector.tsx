import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import { useToast } from "../common/Toast";

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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 className="m-0 text-[0.9375rem]">
              Potential Internal Transfers
            </h3>
            <p className="m-0 text-xs text-text-muted">
              {visibleTransfers.length} possible transfer{visibleTransfers.length !== 1 ? "s" : ""} detected
            </p>
          </div>
        </div>
        {highConfidence.length > 0 && (
          <button
            type="button"
            onClick={handleAutoLink}
            disabled={autoLinking}
            className="px-4 py-2 text-sm bg-amber-500 text-black border-none rounded-md cursor-pointer font-medium hover:bg-amber-600 transition-colors"
          >
            {autoLinking ? "Linking..." : `Auto-link ${highConfidence.length} high confidence`}
          </button>
        )}
      </div>

      <div className="grid gap-3">
        {visibleTransfers.slice(0, 5).map((pair) => {
          const key = `${pair.source.id}-${pair.target.id}`;
          const isLinking = linking.has(key);

          return (
            <div
              key={key}
              className="p-4 bg-bg-input rounded-lg grid gap-3"
            >
              {/* Transfer visualization */}
              <div className="flex items-center gap-4">
                {/* Source (debit) */}
                <div className="flex-1">
                  <div className="text-xs text-text-muted mb-1">
                    {pair.source.account_name} • {formatDate(pair.source.posted_at)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {pair.source.description_raw?.slice(0, 40)}...
                  </div>
                  <div className="font-mono text-red-500 font-semibold">
                    -{formatCurrency(pair.amount)}
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-text-muted">
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Target (credit) */}
                <div className="flex-1">
                  <div className="text-xs text-text-muted mb-1">
                    {pair.target.account_name} • {formatDate(pair.target.posted_at)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {pair.target.description_raw?.slice(0, 40)}...
                  </div>
                  <div className="font-mono text-accent font-semibold">
                    +{formatCurrency(pair.amount)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <div
                  className={`text-xs px-2 py-1 rounded ${
                    pair.confidence >= 80
                      ? "bg-green-500/15 text-green-500"
                      : pair.confidence >= 60
                        ? "bg-yellow-500/15 text-yellow-500"
                        : "bg-bg-secondary text-text-muted"
                  }`}
                >
                  {pair.confidence}% confidence
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDismiss(pair)}
                    className="px-3 py-1.5 text-xs bg-transparent border border-border-subtle rounded text-text-muted hover:text-text-primary"
                  >
                    Not a transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLink(pair)}
                    disabled={isLinking}
                    className="px-3 py-1.5 text-xs bg-accent text-white border-none rounded font-medium disabled:opacity-50"
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
        <div className="mt-3 text-center">
          <span className="text-sm text-text-muted">
            +{visibleTransfers.length - 5} more potential transfers
          </span>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default TransferDetector;
