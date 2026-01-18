import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import ReactDOM from "react-dom";
import type { Category, Subcategory, Transaction } from "../App";
import SubcategorySearch from "./SubcategorySearch";

type Props = {
    transaction: Transaction;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    categories: Category[];
    subcategories: Subcategory[];
    apiBase: string;
};

type SimilarTransaction = {
    id: number;
    description_norm: string;
    amount: number;
    posted_at: string;
    category_id: number | null;
    subcategory_id: number | null;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Math.abs(amount));
};

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 12,
            border: "none",
            background: checked ? "var(--accent)" : "var(--bg-secondary)",
            cursor: "pointer",
            transition: "background 0.2s ease",
            flexShrink: 0,
        }}
    >
        <span
            style={{
                position: "absolute",
                top: 2,
                left: checked ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transition: "left 0.2s ease",
            }}
        />
    </button>
);

const EditTransactionModal = ({
    transaction,
    isOpen,
    onClose,
    onSave,
    categories,
    subcategories,
    apiBase,
}: Props) => {
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
    const [createRule, setCreateRule] = useState(false);
    const [ruleName, setRuleName] = useState("");
    const [similarTxs, setSimilarTxs] = useState<SimilarTransaction[]>([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);
    const [selectedSimilarIds, setSelectedSimilarIds] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [similarPattern, setSimilarPattern] = useState("");
    const [matchingRule, setMatchingRule] = useState<any>(null);
    const [totalSimilarCount, setTotalSimilarCount] = useState(0);
    const [updateAllSimilar, setUpdateAllSimilar] = useState(false);

    // Reset state when transaction changes or modal opens
    useEffect(() => {
        if (isOpen && transaction) {
            setSelectedCategory(transaction.category_id ?? null);
            setSelectedSubcategory(transaction.subcategory_id ?? null);
            setCreateRule(false);
            setRuleName("");
            setSimilarTxs([]);
            setSelectedSimilarIds(new Set([transaction.id]));
            setSimilarPattern("");
            setMatchingRule(null);
            setTotalSimilarCount(0);
            setUpdateAllSimilar(false);
            fetchSimilar();
        }
    }, [transaction, isOpen]);

    const fetchSimilar = () => {
        setLoadingSimilar(true);
        // If we have a custom pattern (and it's not empty), use it. Otherwise backend generates one.
        const url = similarPattern
            ? `${apiBase}/transactions/${transaction.id}/similar?pattern=${encodeURIComponent(similarPattern)}`
            : `${apiBase}/transactions/${transaction.id}/similar`;

        fetchWithAuth(url)
            .then((res) => res.json())
            .then((data) => {
                setSimilarTxs(data.similar || []);
                setTotalSimilarCount(data.total_count || 0);
                // Only update pattern if it was auto-generated (i.e. we didn't have one yet)
                if (!similarPattern) {
                    setSimilarPattern(data.pattern || "");
                }

                // Auto-select all similar transactions initially? 
                // Or just the current one?
                // Transactions.tsx behavior seems to be: 
                // When opening, it sets selectedSimilarIds to new Set([editingTx.id]).
                // Then user can Select All.
                // Wait, logic in Transactions.tsx line 844 (on Refresh) auto-selects ALL.
                // But initial open logic? I should check. 
                // I'll default to just the current one for safety, user can click "Select All".
                // But if I refresh, I probably want to select them.

                if (similarPattern) {
                    // If manual refresh, select all found
                    setSelectedSimilarIds(new Set<number>(data.similar?.map((t: any) => t.id) || []));
                } else {
                    // Initial load
                    setSelectedSimilarIds(new Set([transaction.id]));

                    // If there's an existing matching rule, suggest using its pattern
                    if (data.matching_rule) {
                        setMatchingRule(data.matching_rule);
                        setSimilarPattern(data.matching_rule.pattern);
                        setRuleName(data.matching_rule.name);
                        setCreateRule(true); // Default to updating it
                    }
                }
            })
            .catch((err) => {
                console.error("Failed to fetch similar transactions", err);
                setSimilarTxs([]);
            })
            .finally(() => setLoadingSimilar(false));
    };

    const handleSave = async () => {
        if (!selectedCategory) return;
        setSaving(true);

        const formData = new FormData();
        // Include the current transaction + any selected similar ones
        const allIds = Array.from(selectedSimilarIds);
        // Ensure current transaction is included if it was deselected?
        // Usually user wants to update the current one.
        if (!allIds.includes(transaction.id)) {
            allIds.push(transaction.id);
        }

        allIds.forEach((id) => formData.append("transaction_ids", String(id)));
        formData.append("category_id", String(selectedCategory));
        if (selectedSubcategory) {
            formData.append("subcategory_id", String(selectedSubcategory));
        }
        if (createRule) {
            formData.append("create_rule", "true");
            if (ruleName) formData.append("rule_name", ruleName);
            if (similarPattern) formData.append("rule_pattern", similarPattern);
        }
        if (updateAllSimilar && similarPattern) {
            formData.append("update_all_similar", "true");
            formData.append("rule_pattern", similarPattern);
        }

        try {
            const res = await fetchWithAuth(`${apiBase}/transactions/bulk-update`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error("Failed to update");
            onSave(); // Notify parent
            onClose();
        } catch (err) {
            console.error("Failed to save changes", err);
            alert("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999, // High z-index for portal
                padding: "1rem",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="card"
                style={{
                    width: "100%",
                    maxWidth: 700,
                    maxHeight: "90vh",
                    overflow: "auto",
                    animation: "slideUp 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div className="card-header" style={{ marginBottom: "1rem" }}>
                    <h2>Edit Transaction</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "0.5rem",
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Transaction Details */}
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>
                        {transaction.description_raw}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        <span>{new Date(transaction.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                        <span className="mono" style={{ color: transaction.amount < 0 ? "var(--danger)" : "var(--success)" }}>
                            {transaction.amount < 0 ? "-" : "+"}{formatCurrency(transaction.amount)}
                        </span>
                    </div>
                </div>

                {/* Category Selection */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Category
                    </label>
                    <SubcategorySearch
                        categories={categories}
                        subcategories={subcategories}
                        value={selectedSubcategory ? String(selectedSubcategory) : ""}
                        onChange={(subId, catId) => {
                            setSelectedSubcategory(subId ? Number(subId) : null);
                            setSelectedCategory(catId ? Number(catId) : null);
                        }}
                        placeholder="Search categories..."
                    />
                </div>

                {/* Similar Transactions */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                            Similar Transactions ({similarTxs.length} found)
                        </label>
                        {similarTxs.length > 1 && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    className="secondary"
                                    style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
                                    onClick={() => setSelectedSimilarIds(new Set<number>(similarTxs.map((t) => t.id)))}
                                >
                                    Select All
                                </button>
                                <button
                                    className="secondary"
                                    style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
                                    onClick={() => {
                                        // SQL LIKE to Regex conversion
                                        const escaped = similarPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                                        const regexStr = "^" + escaped.replace(/%/g, ".*").replace(/_/g, ".") + "$";
                                        const regex = new RegExp(regexStr, "i");

                                        const matching = similarTxs.filter(t => regex.test(t.description_norm));
                                        setSelectedSimilarIds(new Set(matching.map(t => t.id)));
                                    }}
                                    title="Select transactions matching the current pattern"
                                >
                                    Select Matching
                                </button>
                                <button
                                    className="secondary"
                                    style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
                                    onClick={() => setSelectedSimilarIds(new Set([transaction.id]))}
                                >
                                    Select None
                                </button>
                            </div>
                        )}
                    </div>

                    {loadingSimilar ? (
                        <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
                            Finding similar transactions...
                        </div>
                    ) : similarTxs.length > 0 ? (
                        <div style={{ maxHeight: 250, overflow: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
                            {similarTxs.map((tx) => (
                                <label
                                    key={tx.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "auto 1fr auto auto",
                                        alignItems: "center",
                                        gap: "0.75rem",
                                        padding: "0.75rem 1rem",
                                        cursor: "pointer",
                                        borderBottom: "1px solid var(--border-color)",
                                        background: selectedSimilarIds.has(tx.id) ? "var(--accent-glow)" : "transparent",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSimilarIds.has(tx.id)}
                                        onChange={(e) => {
                                            const newSet = new Set(selectedSimilarIds);
                                            if (e.target.checked) {
                                                newSet.add(tx.id);
                                            } else if (tx.id !== transaction.id) {
                                                newSet.delete(tx.id);
                                            }
                                            setSelectedSimilarIds(newSet);
                                        }}
                                        disabled={tx.id === transaction.id}
                                        style={{ flexShrink: 0 }}
                                    />
                                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                                        <div style={{
                                            fontSize: "0.8125rem",
                                            color: "var(--text-primary)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            fontWeight: 500,
                                        }}>
                                            {tx.description_norm}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                            {new Date(tx.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        </div>
                                    </div>
                                    <div
                                        className="mono"
                                        style={{
                                            fontSize: "0.8125rem",
                                            color: tx.amount < 0 ? "var(--danger)" : "var(--success)",
                                            textAlign: "right",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {tx.amount < 0 ? "-" : "+"}{formatCurrency(tx.amount)}
                                    </div>
                                    {tx.category_id ? (
                                        <span className="badge" style={{ fontSize: "0.6875rem", whiteSpace: "nowrap" }}>
                                            {categories.find((c) => c.id === tx.category_id)?.name}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>—</span>
                                    )}
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                            No similar transactions found
                        </div>
                    )}

                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {updateAllSimilar ? (
                            <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                                All {totalSimilarCount} matching transactions will be updated
                            </span>
                        ) : (
                            `${selectedSimilarIds.size} transaction${selectedSimilarIds.size !== 1 ? "s" : ""} will be updated`
                        )}
                    </div>

                    {totalSimilarCount > 1 && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: "1rem",
                            padding: "0.75rem",
                            background: "rgba(var(--accent-rgb), 0.05)",
                            borderRadius: "var(--radius-md)",
                            border: "1px dashed var(--accent)"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--accent)" }}>
                                    Global Update
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Apply this category to all {totalSimilarCount} matches
                                </div>
                            </div>
                            <Toggle checked={updateAllSimilar} onChange={setUpdateAllSimilar} />
                        </div>
                    )}
                </div>

                {/* Create Rule Option */}
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                        <div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                                {matchingRule ? "Update existing matching rule" : "Create rule for future transactions"}
                            </div>
                            {matchingRule && (
                                <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "2px" }}>
                                    Matching: {matchingRule.name}
                                </div>
                            )}
                        </div>
                        <Toggle checked={createRule} onChange={setCreateRule} />
                    </div>

                    <div style={{ marginTop: "0.75rem" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                            Pattern (use % for wildcard)
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input
                                type="text"
                                value={similarPattern}
                                onChange={(e) => setSimilarPattern(e.target.value)}
                                style={{
                                    width: "100%",
                                    fontSize: "0.875rem",
                                    padding: "0.375rem 0.625rem",
                                    fontFamily: "monospace",
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "var(--radius-sm)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        fetchSimilar();
                                    }
                                }}
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fetchSimilar();
                                }}
                                title="Refresh similar transactions based on this pattern"
                                style={{
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "var(--radius-sm)",
                                    cursor: "pointer",
                                    padding: "0 0.5rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--text-muted)",
                                }}
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {createRule && (
                        <div style={{ marginTop: "0.75rem" }}>
                            <input
                                type="text"
                                value={ruleName}
                                onChange={(e) => setRuleName(e.target.value)}
                                placeholder="Rule name (optional)"
                                style={{
                                    width: "100%",
                                    fontSize: "0.875rem",
                                    padding: "0.5rem 0.75rem",
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "auto" }}>
                    <button className="secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button className="primary" onClick={handleSave} disabled={!selectedCategory || saving}>
                        {saving ? "Saving..." :
                            updateAllSimilar ? `Update All ${totalSimilarCount} Transactions` :
                                `Update ${selectedSimilarIds.size} Transaction${selectedSimilarIds.size !== 1 ? "s" : ""}`}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EditTransactionModal;
