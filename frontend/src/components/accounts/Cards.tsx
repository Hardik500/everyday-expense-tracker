import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import { PageLoading } from "../ui/Loading";

type Props = {
    apiBase: string;
    refreshKey: number;
    onRefresh?: () => void;
};

type AccountData = {
    account_id: number;
    account_name: string;
    total_spent: number;
    categories: { category_id: number | null; category_name: string | null; total: number }[];
    monthly: { month: string; total: number }[];
};

type CardCoverage = {
    account_id: number;
    account_name: string;
    upgraded_from_id: number | null;
    superseded_by_id: number | null;
    timeline: {
        month: string;
        payments: { date: string; amount: number; description: string }[];
        statements: { file_name: string; transaction_count: number; date_range: string }[];
        has_gap: boolean;
    }[];
    gaps: string[];
    total_payments: number;
    total_statements: number;
};

type CardAccount = {
    id: number;
    name: string;
};

type UntrackedCard = {
    card_name: string;
    pattern: string;
    payment_months: number;
    total_amount: number;
    recent_months: string[];
};

const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 10000000) {
        return `₹${(amount / 10000000).toFixed(2)}Cr`;
    }
    if (absAmount >= 100000) {
        return `₹${(amount / 100000).toFixed(2)}L`;
    }
    if (absAmount >= 1000) {
        return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toFixed(0)}`;
};

function Cards({ apiBase, refreshKey }: Props) {
    const [accountData, setAccountData] = useState<AccountData[]>([]);
    const [cardCoverage, setCardCoverage] = useState<CardCoverage[]>([]);
    const [untrackedCards, setUntrackedCards] = useState<UntrackedCard[]>([]);
    const [allCardAccounts, setAllCardAccounts] = useState<CardAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCard, setExpandedCard] = useState<number | null>(null);
    const [updatingCardId, setUpdatingCardId] = useState<number | null>(null);

    // Fetch spending by account
    useEffect(() => {
        if (accountData.length === 0) {
            setLoading(true);
        }
        fetchWithAuth(`${apiBase}/reports/by-account`)
            .then(res => res.json())
            .then(data => {
                setAccountData(data.accounts || []);
                setLoading(false);
            })
            .catch(() => {
                setAccountData([]);
                setLoading(false);
            });
    }, [apiBase, refreshKey]);

    // Fetch card coverage
    useEffect(() => {
        fetchWithAuth(`${apiBase}/reports/card-coverage`)
            .then(res => res.json())
            .then(data => {
                setCardCoverage(data.cards || []);
                setUntrackedCards(data.untracked_cards || []);
            })
            .catch(() => {
                setCardCoverage([]);
                setUntrackedCards([]);
            });

        // Fetch all card accounts for linking
        fetchWithAuth(`${apiBase}/accounts`)
            .then(res => res.json())
            .then(data => {
                setAllCardAccounts(data.filter((a: any) => a.type === "card"));
            })
            .catch(() => setAllCardAccounts([]));
    }, [apiBase, refreshKey]);

    const handleLinkAccount = async (cardId: number, upgradedFromId: number | null) => {
        setUpdatingCardId(cardId);
        try {
            await fetchWithAuth(`${apiBase}/accounts/${cardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ upgraded_from_id: upgradedFromId || 0 })
            });
            // Refresh both coverage and accounts
            fetchWithAuth(`${apiBase}/reports/card-coverage`)
                .then(res => res.json())
                .then(data => {
                    setCardCoverage(data.cards || []);
                    setUntrackedCards(data.untracked_cards || []);
                });
        } catch (err) {
            console.error("Failed to link account", err);
        } finally {
            setUpdatingCardId(null);
        }
    };

    if (loading) {
        return <PageLoading text="Loading card data..." />;
    }

    return (
        <div style={{ display: "grid", gap: "1.5rem" }}>
            {/* Untracked Cards Warning */}
            {untrackedCards.length > 0 && (
                <div className="card" style={{ borderColor: "#f59e0b", background: "#f59e0b0a" }}>
                    <div className="card-header">
                        <h2>⚠️ Untracked Card Payments Detected</h2>
                    </div>
                    <div style={{ padding: "1rem" }}>
                        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem", fontSize: "0.875rem" }}>
                            We found payments to cards that aren't added to your account yet. Add them to track expenses.
                        </p>
                        <div style={{ display: "grid", gap: "0.75rem" }}>
                            {untrackedCards.map((uc, idx) => (
                                <div key={idx} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "0.75rem 1rem",
                                    background: "var(--bg-secondary)",
                                    borderRadius: "var(--radius-md)"
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{uc.card_name}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {uc.payment_months} months of payments • {formatCurrency(uc.total_amount)} total
                                        </div>
                                    </div>
                                    <span style={{
                                        padding: "0.25rem 0.75rem",
                                        background: "#f59e0b1a",
                                        color: "#f59e0b",
                                        borderRadius: "var(--radius-full)",
                                        fontSize: "0.75rem",
                                        fontWeight: 500
                                    }}>
                                        Not tracked
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Spending by Card */}
            <div className="card">
                <div className="card-header">
                    <h2>💳 Spending by Card</h2>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Click to see monthly breakdown
                    </span>
                </div>
                <div style={{ display: "grid", gap: "1rem" }}>
                    {accountData.map((account) => (
                        <div key={account.account_id}>
                            {/* Card Header Row */}
                            <div
                                onClick={() => setExpandedCard(expandedCard === account.account_id ? null : account.account_id)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "1rem",
                                    padding: "1rem",
                                    background: "var(--bg-input)",
                                    borderRadius: expandedCard === account.account_id ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                                    cursor: "pointer",
                                    transition: "all var(--transition-fast)",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                            >
                                {/* Card Icon */}
                                <div
                                    style={{
                                        width: 40,
                                        height: 28,
                                        borderRadius: 4,
                                        background: account.account_name.includes("HDFC") ? "#004c8f" :
                                            account.account_name.includes("ICICI") ? "#f7941d" :
                                                account.account_name.includes("SBI") ? "#22409a" :
                                                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <svg width="20" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>

                                {/* Card Name */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9375rem" }}>
                                        {account.account_name}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                                        {account.categories.slice(0, 3).map(c => c.category_name || "Other").join(", ")}
                                    </div>
                                </div>

                                {/* Total */}
                                <div
                                    className="mono"
                                    style={{
                                        fontWeight: 600,
                                        color: "#ef4444",
                                        fontSize: "1rem",
                                    }}
                                >
                                    {formatCurrency(account.total_spent)}
                                </div>

                                {/* Expand Icon */}
                                <svg
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    style={{
                                        color: "var(--text-muted)",
                                        transform: expandedCard === account.account_id ? "rotate(180deg)" : "rotate(0)",
                                        transition: "transform var(--transition-fast)",
                                    }}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>

                            {/* Expanded Details */}
                            {expandedCard === account.account_id && (
                                <div
                                    style={{
                                        background: "var(--bg-secondary)",
                                        borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "0",
                                        borderTop: "1px solid var(--border-color)",
                                    }}
                                >
                                    {/* Category Breakdown */}
                                    <div style={{ padding: "1rem", borderRight: "1px solid var(--border-color)" }}>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 500 }}>
                                            BY CATEGORY
                                        </div>
                                        <div style={{ display: "grid", gap: "0.375rem" }}>
                                            {account.categories.slice(0, 6).map((cat, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        fontSize: "0.875rem",
                                                    }}
                                                >
                                                    <span style={{ color: "var(--text-secondary)" }}>
                                                        {cat.category_name || "Other"}
                                                    </span>
                                                    <span className="mono" style={{ color: "var(--text-primary)" }}>
                                                        {formatCurrency(cat.total)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Monthly Bills */}
                                    <div style={{ padding: "1rem" }}>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 500 }}>
                                            MONTHLY BILLS
                                        </div>
                                        <div style={{ display: "grid", gap: "0.5rem" }}>
                                            {account.monthly.map((m, idx) => {
                                                const [year, month] = m.month.split("-");
                                                const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-IN", {
                                                    month: "short",
                                                    year: "numeric",
                                                });
                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            fontSize: "0.875rem",
                                                        }}
                                                    >
                                                        <span style={{ color: "var(--text-secondary)" }}>{monthLabel}</span>
                                                        <span className="mono" style={{ color: "#ef4444" }}>
                                                            {formatCurrency(m.total)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Credit Card Statement Coverage */}
            <div className="card">
                <div className="card-header">
                    <h2>📊 Statement Coverage</h2>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Shows which months have uploaded statements
                    </span>
                </div>

                <div style={{ padding: "1rem" }}>
                    {cardCoverage.length === 0 ? (
                        <p style={{ color: "var(--text-muted)" }}>No credit card accounts found</p>
                    ) : (
                        <div style={{ display: "grid", gap: "1.5rem" }}>
                            {cardCoverage.map(card => (
                                <div key={card.account_id} style={{
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "var(--radius-md)",
                                    overflow: "hidden",
                                    marginBottom: "1rem"
                                }}>
                                    <div style={{
                                        padding: "1rem",
                                        background: "var(--bg-secondary)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{card.account_name}</div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                {card.total_statements} months with data • {card.gaps.length} gaps
                                                {card.superseded_by_id && (
                                                    <span style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>
                                                        • Upgraded to {allCardAccounts.find(a => a.id === card.superseded_by_id)?.name || "another card"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {card.gaps.length > 0 && (
                                            <span style={{
                                                padding: "0.25rem 0.75rem",
                                                background: "#ef44441a",
                                                color: "#ef4444",
                                                borderRadius: "var(--radius-full)",
                                                fontSize: "0.75rem",
                                                fontWeight: 500
                                            }}>
                                                {card.gaps.length} gaps
                                            </span>
                                        )}
                                    </div>

                                    {/* Upgrade Settings */}
                                    <div style={{
                                        padding: "0.75rem 1rem",
                                        background: "var(--bg-input)",
                                        borderTop: "1px solid var(--border-color)",
                                        borderBottom: "1px solid var(--border-color)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "1rem",
                                        fontSize: "0.8125rem"
                                    }}>
                                        <div style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Upgrade Settings:</div>
                                        <select
                                            value={card.upgraded_from_id || ""}
                                            onChange={(e) => handleLinkAccount(card.account_id, e.target.value ? Number(e.target.value) : null)}
                                            disabled={updatingCardId === card.account_id}
                                            style={{
                                                background: "var(--bg-secondary)",
                                                border: "1px solid var(--border-subtle)",
                                                color: "var(--text-primary)",
                                                borderRadius: "var(--radius-sm)",
                                                padding: "2px 8px",
                                                outline: "none"
                                            }}
                                        >
                                            <option value="">This is a new card</option>
                                            {allCardAccounts
                                                .filter(a => a.id !== card.account_id)
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>Upgraded from {a.name}</option>
                                                ))
                                            }
                                        </select>
                                        {updatingCardId === card.account_id && <span style={{ color: "var(--accent)", fontSize: "0.75rem" }}>Saving...</span>}
                                    </div>

                                    {/* Timeline */}
                                    <div style={{ padding: "1rem", display: "grid", gap: "0.5rem", maxHeight: "400px", overflowY: "auto" }}>
                                        {card.timeline.map((t, idx) => {
                                            const [year, month] = t.month.split("-");
                                            const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-IN", {
                                                month: "short",
                                                year: "numeric",
                                            });
                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "1rem",
                                                        padding: "0.5rem 0.75rem",
                                                        background: t.has_gap ? "#ef44440a" : "transparent",
                                                        borderRadius: "var(--radius-sm)",
                                                        borderLeft: t.has_gap ? "3px solid #ef4444" : "3px solid #10b981"
                                                    }}
                                                >
                                                    <div style={{ width: 80, fontWeight: 500 }}>{monthLabel}</div>
                                                    <div style={{ flex: 1 }}>
                                                        {t.statements.length > 0 ? (
                                                            <span style={{ color: "#10b981", fontSize: "0.875rem" }}>
                                                                ✓ {t.statements[0].transaction_count} transactions
                                                            </span>
                                                        ) : t.payments.length > 0 ? (
                                                            <span style={{ color: "#ef4444", fontSize: "0.875rem" }}>
                                                                ⚠ Missing statement (paid {formatCurrency(t.payments.reduce((sum, p) => sum + p.amount, 0))})
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>—</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Cards;
