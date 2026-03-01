import { useState, useEffect, useCallback } from "react";
import PageHeader from "../components/layout/PageHeader";
import { useAuth } from "../contexts/AuthContext";

type Props = {
    apiBase: string;
    refreshKey: number;
    onRefresh: () => void;
};

type EmailImport = {
    id: number;
    gmail_message_id: string;
    sender: string | null;
    subject: string | null;
    received_at: string | null;
    status: string;
    error_message: string | null;
    attachments_found: number;
    transactions_imported: number;
    transactions_skipped: number;
    created_at: string;
};

type MissingStatement = {
    id: number;
    email_import_id: number | null;
    sender: string | null;
    subject: string | null;
    received_at: string | null;
    reason: string;
    resolved: boolean;
    created_at: string;
};

type SyncStatus = {
    gmail_enabled: boolean;
    gmail_connected: boolean;
    last_sync: string | null;
    total_imports: number;
    total_transactions_imported: number;
    total_missing: number;
    is_syncing: boolean;
};

type Account = {
    id: number;
    name: string;
    type: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    success: { label: "Imported", color: "var(--color-success)", bg: "rgba(34,197,94,0.12)" },
    failed: { label: "Failed", color: "var(--color-danger)", bg: "rgba(239,68,68,0.12)" },
    processing: { label: "Processing", color: "var(--color-warning)", bg: "rgba(234,179,8,0.12)" },
    skipped: { label: "Skipped", color: "var(--color-text-muted)", bg: "var(--color-bg-tertiary)" },
};

const REASON_LABELS: Record<string, string> = {
    no_attachment: "No attachment found",
    unsupported_format: "Unsupported file format",
    parse_failed: "Failed to parse",
};

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return dateStr;
    }
}

function formatSender(sender: string | null): string {
    if (!sender) return "Unknown sender";
    // Extract name from "Name <email@example.com>" format
    const match = sender.match(/^"?([^"<]+)"?\s*</);
    if (match) return match[1].trim();
    // Just email
    const emailMatch = sender.match(/<([^>]+)>/);
    if (emailMatch) return emailMatch[1];
    return sender;
}

export default function EmailImportsPage({ apiBase, refreshKey, onRefresh }: Props) {
    const { token } = useAuth();
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [imports, setImports] = useState<EmailImport[]>([]);
    const [missing, setMissing] = useState<MissingStatement[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [resolveId, setResolveId] = useState<number | null>(null);
    const [resolveAccountId, setResolveAccountId] = useState<number | null>(null);
    const [resolveFile, setResolveFile] = useState<File | null>(null);
    const [resolving, setResolving] = useState(false);
    const [expandedImport, setExpandedImport] = useState<number | null>(null);

    const headers = useCallback(
        () => ({
            Authorization: `Bearer ${token}`,
        }),
        [token]
    );

    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [statusRes, importsRes, missingRes, accountsRes] = await Promise.all([
                fetch(`${apiBase}/user/gmail/status`, { headers: headers() }),
                fetch(`${apiBase}/email-imports?limit=50`, { headers: headers() }),
                fetch(`${apiBase}/missing-statements?resolved=false`, { headers: headers() }),
                fetch(`${apiBase}/accounts`, { headers: headers() }),
            ]);
            if (statusRes.ok) setSyncStatus(await statusRes.json());
            if (importsRes.ok) setImports(await importsRes.json());
            if (missingRes.ok) setMissing(await missingRes.json());
            if (accountsRes.ok) setAccounts(await accountsRes.json());
        } catch (err) {
            console.error("Failed to fetch email imports data:", err);
        } finally {
            setLoading(false);
        }
    }, [apiBase, token, headers]);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshKey]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch(`${apiBase}/user/gmail/sync`, {
                method: "POST",
                headers: headers(),
            });
            if (res.ok) {
                // Poll for completion
                const pollInterval = setInterval(async () => {
                    const statusRes = await fetch(`${apiBase}/user/gmail/status`, { headers: headers() });
                    if (statusRes.ok) {
                        const status = await statusRes.json();
                        setSyncStatus(status);
                        if (!status.is_syncing) {
                            clearInterval(pollInterval);
                            setSyncing(false);
                            fetchData();
                            onRefresh();
                        }
                    }
                }, 3000);
                // Timeout after 5 minutes
                setTimeout(() => {
                    clearInterval(pollInterval);
                    setSyncing(false);
                    fetchData();
                }, 300000);
            } else {
                setSyncing(false);
            }
        } catch {
            setSyncing(false);
        }
    };

    const handleResolve = async (msId: number) => {
        if (!resolveFile || !resolveAccountId) return;
        setResolving(true);
        try {
            const formData = new FormData();
            formData.append("file", resolveFile);
            formData.append("account_id", resolveAccountId.toString());

            const res = await fetch(`${apiBase}/missing-statements/${msId}/resolve`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (res.ok) {
                setResolveId(null);
                setResolveFile(null);
                setResolveAccountId(null);
                fetchData();
                onRefresh();
            }
        } catch (err) {
            console.error("Failed to resolve missing statement:", err);
        } finally {
            setResolving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-transition-scale grid gap-6">
                <PageHeader
                    title="Email Imports"
                    description="Auto-imported bank statements from your Gmail"
                />
                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--color-border)", borderTopColor: "var(--color-accent)", borderRadius: "50%" }} />
                </div>
            </div>
        );
    }

    return (
        <div className="page-transition-scale grid gap-6">
            <PageHeader
                title="Email Imports"
                description="Auto-imported bank statements from your Gmail"
            />

            {/* ── Sync Status Card ── */}
            <div
                style={{
                    background: "var(--color-bg-secondary)",
                    borderRadius: 16,
                    border: "1px solid var(--color-border)",
                    padding: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "1rem",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: syncStatus?.gmail_connected ? "var(--color-success)" : "var(--color-text-muted)",
                            }}
                        />
                        <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {syncStatus?.gmail_connected ? "Gmail Connected" : "Gmail Not Connected"}
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--color-text-muted)" }}>
                        <span>Last sync: {syncStatus?.last_sync ? formatDate(syncStatus.last_sync) : "Never"}</span>
                        <span>{syncStatus?.total_imports ?? 0} emails processed</span>
                        <span>{syncStatus?.total_transactions_imported ?? 0} transactions imported</span>
                    </div>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing || !syncStatus?.gmail_connected}
                    style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        background: syncing ? "var(--color-bg-tertiary)" : "var(--color-accent)",
                        color: syncing ? "var(--color-text-muted)" : "#fff",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: syncing || !syncStatus?.gmail_connected ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "all 0.15s",
                    }}
                >
                    {syncing ? (
                        <>
                            <div className="animate-spin" style={{ width: 16, height: 16, border: "2px solid var(--color-text-muted)", borderTopColor: "var(--color-accent)", borderRadius: "50%" }} />
                            Syncing...
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Sync Now
                        </>
                    )}
                </button>
            </div>

            {/* ── Missing Statements Alert ── */}
            {missing.length > 0 && (
                <div
                    style={{
                        background: "rgba(234,179,8,0.08)",
                        borderRadius: 16,
                        border: "1px solid rgba(234,179,8,0.25)",
                        padding: "1.5rem",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <svg width="20" height="20" fill="none" stroke="rgb(234,179,8)" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span style={{ fontWeight: 600, color: "rgb(234,179,8)" }}>
                            {missing.length} statement{missing.length > 1 ? "s" : ""} need manual upload
                        </span>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                        {missing.map((ms) => (
                            <div
                                key={ms.id}
                                style={{
                                    background: "var(--color-bg-secondary)",
                                    borderRadius: 12,
                                    padding: "1rem 1.25rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: "0.75rem",
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ fontWeight: 500, color: "var(--color-text-primary)", fontSize: 14 }}>
                                        {ms.subject || "No subject"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                                        From: {formatSender(ms.sender)} · {formatDate(ms.received_at)} · {REASON_LABELS[ms.reason] || ms.reason}
                                    </div>
                                </div>

                                {resolveId === ms.id ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <select
                                            value={resolveAccountId ?? ""}
                                            onChange={(e) => setResolveAccountId(Number(e.target.value) || null)}
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: 8,
                                                border: "1px solid var(--color-border)",
                                                background: "var(--color-bg-primary)",
                                                color: "var(--color-text-primary)",
                                                fontSize: 13,
                                            }}
                                        >
                                            <option value="">Select account</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="file"
                                            accept=".pdf,.csv,.xls,.xlsx,.ofx,.qfx,.txt"
                                            onChange={(e) => setResolveFile(e.target.files?.[0] || null)}
                                            style={{ fontSize: 13 }}
                                        />
                                        <button
                                            onClick={() => handleResolve(ms.id)}
                                            disabled={resolving || !resolveFile || !resolveAccountId}
                                            style={{
                                                padding: "6px 14px",
                                                borderRadius: 8,
                                                border: "none",
                                                background: resolving ? "var(--color-bg-tertiary)" : "var(--color-success)",
                                                color: "#fff",
                                                fontWeight: 600,
                                                fontSize: 13,
                                                cursor: resolving || !resolveFile || !resolveAccountId ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            {resolving ? "Uploading..." : "Upload"}
                                        </button>
                                        <button
                                            onClick={() => { setResolveId(null); setResolveFile(null); setResolveAccountId(null); }}
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: 8,
                                                border: "1px solid var(--color-border)",
                                                background: "transparent",
                                                color: "var(--color-text-muted)",
                                                fontSize: 13,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setResolveId(ms.id)}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: 8,
                                            border: "1px solid var(--color-accent)",
                                            background: "transparent",
                                            color: "var(--color-accent)",
                                            fontWeight: 500,
                                            fontSize: 13,
                                            cursor: "pointer",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        Upload Statement
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Import History ── */}
            <div
                style={{
                    background: "var(--color-bg-secondary)",
                    borderRadius: 16,
                    border: "1px solid var(--color-border)",
                    overflow: "hidden",
                }}
            >
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" }}>
                    <h3 style={{ margin: 0, fontWeight: 600, color: "var(--color-text-primary)" }}>Import History</h3>
                </div>

                {imports.length === 0 ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-muted)" }}>
                        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: "0 auto 12px", opacity: 0.4 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p style={{ margin: 0, fontSize: 14 }}>No email imports yet</p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7 }}>
                            {syncStatus?.gmail_connected
                                ? "Click 'Sync Now' to scan your Gmail for bank statements"
                                : "Connect your Gmail in Settings to auto-import statements"
                            }
                        </p>
                    </div>
                ) : (
                    <div>
                        {imports.map((imp) => {
                            const config = STATUS_CONFIG[imp.status] || STATUS_CONFIG.processing;
                            const isExpanded = expandedImport === imp.id;

                            return (
                                <div
                                    key={imp.id}
                                    style={{
                                        borderBottom: "1px solid var(--color-border)",
                                        cursor: "pointer",
                                        transition: "background 0.1s",
                                    }}
                                    onClick={() => setExpandedImport(isExpanded ? null : imp.id)}
                                >
                                    <div
                                        style={{
                                            padding: "1rem 1.5rem",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        {/* Status badge */}
                                        <span
                                            style={{
                                                padding: "3px 10px",
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: config.color,
                                                background: config.bg,
                                                letterSpacing: 0.3,
                                                textTransform: "uppercase",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {config.label}
                                        </span>

                                        {/* Sender & Subject */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 500,
                                                    color: "var(--color-text-primary)",
                                                    fontSize: 14,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {imp.subject || "No subject"}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                                                {formatSender(imp.sender)}
                                            </div>
                                        </div>

                                        {/* Counts */}
                                        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--color-text-muted)", flexShrink: 0 }}>
                                            {imp.transactions_imported > 0 && (
                                                <span style={{ color: "var(--color-success)" }}>
                                                    +{imp.transactions_imported} txns
                                                </span>
                                            )}
                                            {imp.attachments_found > 0 && (
                                                <span>{imp.attachments_found} file{imp.attachments_found > 1 ? "s" : ""}</span>
                                            )}
                                        </div>

                                        {/* Date */}
                                        <span style={{ fontSize: 12, color: "var(--color-text-muted)", flexShrink: 0 }}>
                                            {formatDate(imp.received_at || imp.created_at)}
                                        </span>

                                        {/* Expand chevron */}
                                        <svg
                                            width="16"
                                            height="16"
                                            fill="none"
                                            stroke="var(--color-text-muted)"
                                            viewBox="0 0 24 24"
                                            style={{
                                                transition: "transform 0.15s",
                                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div
                                            style={{
                                                padding: "0 1.5rem 1rem",
                                                fontSize: 13,
                                                color: "var(--color-text-muted)",
                                                display: "grid",
                                                gap: 6,
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div>
                                                <strong>Gmail Message ID:</strong> {imp.gmail_message_id}
                                            </div>
                                            <div>
                                                <strong>Attachments found:</strong> {imp.attachments_found}
                                            </div>
                                            <div>
                                                <strong>Transactions imported:</strong> {imp.transactions_imported}
                                            </div>
                                            <div>
                                                <strong>Transactions skipped:</strong> {imp.transactions_skipped}
                                            </div>
                                            {imp.error_message && (
                                                <div style={{ color: "var(--color-danger)" }}>
                                                    <strong>Error:</strong> {imp.error_message}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
