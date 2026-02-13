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
      <div className="card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading AI suggestions...
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
      <div
        style={{
          padding: "1rem 1.25rem",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.1))",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {suggestions.length} AI Category Suggestion{suggestions.length !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Review and approve new categories suggested by AI
            </div>
          </div>
        </div>
        <button
          onClick={approveAll}
          className="primary"
          style={{
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            fontSize: "0.8125rem",
          }}
        >
          Approve All
        </button>
      </div>

      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {suggestions.map((s) => (
          <div
            key={s.id}
            style={{
              padding: "0.875rem 1.25rem",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={s.description_raw}
              >
                {s.description_raw}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                {formatDate(s.posted_at)} • {s.amount < 0 ? "-" : "+"}
                {formatCurrency(s.amount)}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.25rem 0.625rem",
                  background: s.existing_category_id ? "var(--bg-input)" : "rgba(139, 92, 246, 0.15)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: s.existing_category_id ? "var(--text-secondary)" : "#a78bfa",
                }}
              >
                {!s.existing_category_id && <span>✨ New:</span>}
                {s.suggested_category} → {s.suggested_subcategory}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button
                onClick={() => reject(s.id)}
                disabled={processing[s.id]}
                className="ghost"
                style={{ padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}
              >
                ✕
              </button>
              <button
                onClick={() => approve(s.id)}
                disabled={processing[s.id]}
                className="primary"
                style={{
                  padding: "0.375rem 0.625rem",
                  fontSize: "0.75rem",
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                }}
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
