import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import ReactDOM from "react-dom";
import type { Category, Subcategory, Transaction } from "../types";
import SubcategorySearch from "../categories/SubcategorySearch";

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
        className={`relative w-11 h-6 rounded-full border-none cursor-pointer transition-colors shrink-0 ${checked ? "bg-[var(--accent)]" : "bg-[var(--bg-secondary)]"}`}
    >
        <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
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
    const [notes, setNotes] = useState<string>("");
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
            setNotes(transaction.notes || "");
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
        // Update notes for current transaction if changed
        const notesChanged = notes !== (transaction.notes || '');
        if (notesChanged && notes.trim() !== '') {
            try {
                const res = await fetchWithAuth(`${apiBase}/transactions/${transaction.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes }),
                });
                if (!res.ok) throw new Error('Failed to save notes');
            } catch (err) {
                console.error('Failed to save notes', err);
                alert('Failed to save notes');
                return;
            }
        }

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
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="card w-full max-w-[700px] max-h-[90vh] overflow-auto animate-[slideUp_0.2s_ease] flex flex-col"
            >
                <div className="card-header mb-4">
                    <h2>Edit Transaction</h2>
                    <button
                        onClick={onClose}
                        className="bg-transparent border-none text-text-muted cursor-pointer p-2"
                    >
                        ✕
                    </button>
                </div>

                {/* Transaction Details */}
                <div className="mb-6 p-4 bg-bg-input rounded-lg">
                    <div className="text-sm text-text-primary font-medium">
                        {transaction.description_raw}
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-text-muted">
                        <span>{new Date(transaction.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                        <span className={`mono ${transaction.amount < 0 ? "text-danger" : "text-success"}`}>
                            {transaction.amount < 0 ? "-" : "+"}{formatCurrency(transaction.amount)}
                        </span>
                    </div>
                </div>

                {/* Category Selection */}
                <div className="mb-6">
                    <label className="block mb-2 text-sm text-text-muted">
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

                {/* Notes Field */}
                <div className="mb-6">
                    <label className="block mb-2 text-sm text-text-muted">
                        Notes
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this transaction..."
                        className="w-full min-h-[80px] text-sm p-3 bg-bg-input border border-border-color rounded-lg text-text-primary resize-y font-inherit"
                    />
                </div>

                {/* Similar Transactions */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm text-text-muted">
                            Similar Transactions ({similarTxs.length} found)
                        </label>
                        {similarTxs.length > 1 && (
                            <div className="flex gap-2">
                                <button
                                    className="secondary px-3 py-1 text-xs"
                                    onClick={() => setSelectedSimilarIds(new Set<number>(similarTxs.map((t) => t.id)))}
                                >
                                    Select All
                                </button>
                                <button
                                    className="secondary px-3 py-1 text-xs"
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
                                    className="secondary px-3 py-1 text-xs"
                                    onClick={() => setSelectedSimilarIds(new Set([transaction.id]))}
                                >
                                    Select None
                                </button>
                            </div>
                        )}
                    </div>

                    {loadingSimilar ? (
                        <div className="p-4 text-center text-text-muted">
                            Finding similar transactions...
                        </div>
                    ) : similarTxs.length > 0 ? (
                        <div className="max-h-[250px] overflow-auto border border-border-color rounded-lg">
                            {similarTxs.map((tx) => (
                                <label
                                    key={tx.id}
                                    className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 cursor-pointer border-b border-border-color ${selectedSimilarIds.has(tx.id) ? "bg-accent-glow" : "bg-transparent"}`}
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
                                        className="shrink-0"
                                    />
                                    <div className="min-w-0 overflow-hidden">
                                        <div className="text-sm text-text-primary overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                                            {tx.description_norm}
                                        </div>
                                        <div className="text-xs text-text-muted mt-0.5">
                                            {new Date(tx.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        </div>
                                    </div>
                                    <div
                                        className={`mono text-sm text-right whitespace-nowrap ${tx.amount < 0 ? "text-danger" : "text-success"}`}
                                    >
                                        {tx.amount < 0 ? "-" : "+"}{formatCurrency(tx.amount)}
                                    </div>
                                    {tx.category_id ? (
                                        <span
                                            className="badge text-[11px] whitespace-nowrap flex items-center gap-1"
                                            style={{
                                                background: categories.find(c => c.id === tx.category_id)?.color ? `${categories.find(c => c.id === tx.category_id)?.color}20` : undefined,
                                                color: categories.find(c => c.id === tx.category_id)?.color || 'var(--accent)'
                                            }}
                                        >
                                            {categories.find(c => c.id === tx.category_id)?.color && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full inline-block"
                                                    style={{ background: categories.find(c => c.id === tx.category_id)?.color }}
                                                />
                                            )}
                                            {categories.find((c) => c.id === tx.category_id)?.name}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-text-muted">—</span>
                                    )}
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-text-muted text-sm">
                            No similar transactions found
                        </div>
                    )}

                    <div className="mt-2 text-xs text-text-muted">
                        {updateAllSimilar ? (
                            <span className="text-accent font-medium">
                                All {totalSimilarCount} matching transactions will be updated
                            </span>
                        ) : (
                            `${selectedSimilarIds.size} transaction${selectedSimilarIds.size !== 1 ? "s" : ""} will be updated`
                        )}
                    </div>

                    {totalSimilarCount > 1 && (
                        <div className="flex items-center justify-between mt-4 p-3 bg-accent/5 rounded-lg border border-dashed border-accent">
                            <div>
                                <div className="text-sm font-semibold text-accent">
                                    Global Update
                                </div>
                                <div className="text-xs text-text-muted mt-0.5">
                                    Apply this category to all {totalSimilarCount} matches
                                </div>
                            </div>
                            <Toggle checked={updateAllSimilar} onChange={setUpdateAllSimilar} />
                        </div>
                    )}
                </div>

                {/* Create Rule Option */}
                <div className="mb-6 p-4 bg-bg-input rounded-lg">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-medium">
                                {matchingRule ? "Update existing matching rule" : "Create rule for future transactions"}
                            </div>
                            {matchingRule && (
                                <div className="text-xs text-accent mt-0.5">
                                    Matching: {matchingRule.name}
                                </div>
                            )}
                        </div>
                        <Toggle checked={createRule} onChange={setCreateRule} />
                    </div>

                    <div className="mt-3">
                        <div className="text-xs text-text-muted mb-1">
                            Pattern (use % for wildcard)
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={similarPattern}
                                onChange={(e) => setSimilarPattern(e.target.value)}
                                className="w-full text-sm px-2.5 py-1.5 font-mono bg-bg-secondary border border-border-color rounded"
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
                                className="bg-bg-secondary border border-border-color rounded cursor-pointer px-2 flex items-center justify-center text-text-muted"
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {createRule && (
                        <div className="mt-3">
                            <input
                                type="text"
                                value={ruleName}
                                onChange={(e) => setRuleName(e.target.value)}
                                placeholder="Rule name (optional)"
                                className="w-full text-sm p-3 bg-bg-secondary border border-border-color rounded text-text-primary"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-auto">
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