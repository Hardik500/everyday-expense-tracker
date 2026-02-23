import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";

type Suggestion = {
  id: number;
  transaction_id: number;
  suggested_category: string;
  suggested_subcategory: string;
  existing_category_id: number | null;
  existing_subcategory_id: number | null;
  regex_pattern: string | null;
  confidence: string;
  description_raw: string;
  amount: number;
  posted_at: string;
};

type Props = {
  apiBase: string;
  refreshKey: number;
  onUpdated: () => void;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

function AISuggestions({ apiBase, refreshKey, onUpdated }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});

  const fetchSuggestions = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/ai/suggestions?status=pending`);
      const data = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [apiBase, refreshKey]);

  const approve = async (id: number) => {
    setProcessing((p) => ({ ...p, [id]: true }));
    try {
      await fetchWithAuth(`${apiBase}/ai/suggestions/${id}/approve`, { method: "POST" });
      setSuggestions((s) => s.filter((x) => x.id !== id));
      onUpdated();
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }));
    }
  };

  const reject = async (id: number) => {
    setProcessing((p) => ({ ...p, [id]: true }));
    try {
      await fetchWithAuth(`${apiBase}/ai/suggestions/${id}/reject`, { method: "POST" });
      setSuggestions((s) => s.filter((x) => x.id !== id));
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }));
    }
  };

  const approveAll = async () => {
    setLoading(true);
    try {
      await fetchWithAuth(`${apiBase}/ai/suggestions/approve-all`, { method: "POST" });
      setSuggestions([]);
      onUpdated();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-4 text-center text-text-muted">
        Loading AI suggestions...
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-br from-purple-500/15 to-indigo-500/10 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-text-primary">
              {suggestions.length} AI Category Suggestion{suggestions.length !== 1 ? "s" : ""}
            </div>
            <div className="text-sm text-text-muted">
              Review and approve new categories suggested by AI
            </div>
          </div>
        </div>
        <button
          onClick={approveAll}
          className="primary text-sm bg-gradient-to-br from-purple-500 to-indigo-500"
        >
          Approve All
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="px-5 py-3.5 border-b border-border-color flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div
                className="text-sm text-text-primary whitespace-nowrap overflow-hidden text-ellipsis"
                title={s.description_raw}
              >
                {s.description_raw}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {formatDate(s.posted_at)} • {s.amount < 0 ? "-" : "+"}
                {formatCurrency(s.amount)}
              </div>
            </div>

            <div className="text-right">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  s.existing_category_id
                    ? "bg-bg-input text-text-secondary"
                    : "bg-purple-500/15 text-purple-400"
                }`}
              >
                {!s.existing_category_id && <span>✨ New:</span>}
                {s.suggested_category} → {s.suggested_subcategory}
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => reject(s.id)}
                disabled={processing[s.id]}
                className="ghost px-2.5 py-1.5 text-xs"
              >
                ✕
              </button>
              <button
                onClick={() => approve(s.id)}
                disabled={processing[s.id]}
                className="primary px-2.5 py-1.5 text-xs bg-gradient-to-br from-purple-500 to-indigo-500"
              >
                ✓ Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AISuggestions;