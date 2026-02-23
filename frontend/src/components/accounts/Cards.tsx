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
        <div className="grid gap-6">
            {/* Untracked Cards Warning */}
            {untrackedCards.length > 0 && (
                <div className="card border-amber-500 bg-amber-500/5">
                    <div className="card-header">
                        <h2>⚠️ Untracked Card Payments Detected</h2>
                    </div>
                    <div className="p-4">
                        <p className="text-text-secondary mb-4 text-sm">
                            We found payments to cards that aren't added to your account yet. Add them to track expenses.
                        </p>
                        <div className="grid gap-3">
                            {untrackedCards.map((uc, idx) => (
                                <div key={idx} className="flex justify-between items-center px-4 py-3 bg-bg-secondary rounded-lg">
                                    <div>
                                        <div className="font-semibold">{uc.card_name}</div>
                                        <div className="text-xs text-text-muted">
                                            {uc.payment_months} months of payments • {formatCurrency(uc.total_amount)} total
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-medium">
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
                    <span className="text-xs text-text-muted">
                        Click to see monthly breakdown
                    </span>
                </div>
                <div className="grid gap-4">
                    {accountData.map((account) => (
                        <div key={account.account_id}>
                            {/* Card Header Row */}
                            <div
                                onClick={() => setExpandedCard(expandedCard === account.account_id ? null : account.account_id)}
                                className="flex items-center gap-4 p-4 bg-bg-input cursor-pointer transition-all hover:bg-bg-hover"
                                style={{ borderRadius: expandedCard === account.account_id ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)" }}
                            >
                                {/* Card Icon */}
                                <div
                                    className="w-10 h-7 rounded flex items-center justify-center shrink-0"
                                    style={{
                                        background: account.account_name.includes("HDFC") ? "#004c8f" :
                                            account.account_name.includes("ICICI") ? "#f7941d" :
                                                account.account_name.includes("SBI") ? "#22409a" :
                                                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    }}
                                >
                                    <svg width="20" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>

                                {/* Card Name */}
                                <div className="flex-1">
                                    <div className="font-semibold text-text-primary text-[0.9375rem]">
                                        {account.account_name}
                                    </div>
                                    <div className="text-xs text-text-muted mt-0.5">
                                        {account.categories.slice(0, 3).map(c => c.category_name || "Other").join(", ")}
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="mono font-semibold text-red-500 text-base">
                                    {formatCurrency(account.total_spent)}
                                </div>

                                {/* Expand Icon */}
                                <svg
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    className="text-text-muted transition-transform"
                                    style={{ transform: expandedCard === account.account_id ? "rotate(180deg)" : "rotate(0)" }}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>

                            {/* Expanded Details */}
                            {expandedCard === account.account_id && (
                                <div className="bg-bg-secondary rounded-b-lg grid grid-cols-2 gap-0 border-t border-border-color">
                                    {/* Category Breakdown */}
                                    <div className="p-4 border-r border-border-color">
                                        <div className="text-xs text-text-muted mb-2 font-medium">
                                            BY CATEGORY
                                        </div>
                                        <div className="grid gap-1.5">
                                            {account.categories.slice(0, 6).map((cat, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex justify-between items-center text-sm"
                                                >
                                                    <span className="text-text-secondary">
                                                        {cat.category_name || "Other"}
                                                    </span>
                                                    <span className="mono text-text-primary">
                                                        {formatCurrency(cat.total)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Monthly Bills */}
                                    <div className="p-4">
                                        <div className="text-xs text-text-muted mb-2 font-medium">
                                            MONTHLY BILLS
                                        </div>
                                        <div className="grid gap-2">
                                            {account.monthly.map((m, idx) => {
                                                const [year, month] = m.month.split("-");
                                                const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-IN", {
                                                    month: "short",
                                                    year: "numeric",
                                                });
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex justify-between items-center text-sm"
                                                    >
                                                        <span className="text-text-secondary">{monthLabel}</span>
                                                        <span className="mono text-red-500">
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
                    <span className="text-xs text-text-muted">
                        Shows which months have uploaded statements
                    </span>
                </div>

                <div className="p-4">
                    {cardCoverage.length === 0 ? (
                        <p className="text-text-muted">No credit card accounts found</p>
                    ) : (
                        <div className="grid gap-6">
                            {cardCoverage.map(card => (
                                <div key={card.account_id} className="border border-border-color rounded-lg overflow-hidden mb-4">
                                    <div className="p-4 bg-bg-secondary flex justify-between items-center">
                                        <div>
                                            <div className="font-semibold">{card.account_name}</div>
                                            <div className="text-xs text-text-muted">
                                                {card.total_statements} months with data • {card.gaps.length} gaps
                                                {card.superseded_by_id && (
                                                    <span className="text-accent ml-2">
                                                        • Upgraded to {allCardAccounts.find(a => a.id === card.superseded_by_id)?.name || "another card"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {card.gaps.length > 0 && (
                                            <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-medium">
                                                {card.gaps.length} gaps
                                            </span>
                                        )}
                                    </div>

                                    {/* Upgrade Settings */}
                                    <div className="px-4 py-3 bg-bg-input border-t border-b border-border-color flex items-center gap-4 text-sm">
                                        <div className="text-text-secondary font-medium">Upgrade Settings:</div>
                                        <select
                                            value={card.upgraded_from_id || ""}
                                            onChange={(e) => handleLinkAccount(card.account_id, e.target.value ? Number(e.target.value) : null)}
                                            disabled={updatingCardId === card.account_id}
                                            className="bg-bg-secondary border border-border-subtle text-text-primary rounded px-2 py-0.5 outline-none"
                                        >
                                            <option value="">This is a new card</option>
                                            {allCardAccounts
                                                .filter(a => a.id !== card.account_id)
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>Upgraded from {a.name}</option>
                                                ))
                                            }
                                        </select>
                                        {updatingCardId === card.account_id && <span className="text-accent text-xs">Saving...</span>}
                                    </div>

                                    {/* Timeline */}
                                    <div className="p-4 grid gap-2 max-h-[400px] overflow-y-auto">
                                        {card.timeline.map((t, idx) => {
                                            const [year, month] = t.month.split("-");
                                            const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-IN", {
                                                month: "short",
                                                year: "numeric",
                                            });
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center gap-4 px-3 py-2 rounded ${t.has_gap ? "bg-red-500/5" : ""}`}
                                                    style={{ borderLeft: t.has_gap ? "3px solid #ef4444" : "3px solid #10b981" }}
                                                >
                                                    <div className="w-20 font-medium">{monthLabel}</div>
                                                    <div className="flex-1">
                                                        {t.statements.length > 0 ? (
                                                            <span className="text-emerald-500 text-sm">
                                                                ✓ {t.statements[0].transaction_count} transactions
                                                            </span>
                                                        ) : t.payments.length > 0 ? (
                                                            <span className="text-red-500 text-sm">
                                                                ⚠ Missing statement (paid {formatCurrency(t.payments.reduce((sum, p) => sum + p.amount, 0))})
                                                            </span>
                                                        ) : (
                                                            <span className="text-text-muted text-sm">—</span>
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