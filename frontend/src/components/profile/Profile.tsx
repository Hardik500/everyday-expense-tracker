import { useState, useEffect } from "react";
import { fetchWithAuth } from "../../utils/api";
import { PageLoading } from "../ui/Loading";

type Props = {
    apiBase: string;
};

type UserProfile = {
    id: number;
    username: string;
    email: string | null;
    gmail_enabled: boolean;
    gmail_last_sync: string | null;
    gmail_filter_query: string | null;
};

function Profile({ apiBase }: Props) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [filterQuery, setFilterQuery] = useState("");

    // Username edit states
    const [editingUsername, setEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState("");

    const fetchProfile = async () => {
        try {
            const res = await fetchWithAuth(`${apiBase}/auth/me`);
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setFilterQuery(data.gmail_filter_query || "");
            }
        } catch (err) {
            setError("Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleConnectGmail = async () => {
        try {
            const res = await fetchWithAuth(`${apiBase}/auth/google/url`);
            if (res.ok) {
                const { url } = await res.json();
                window.location.href = url;
            } else {
                setError("Failed to generate Google connection URL");
            }
        } catch (err) {
            setError("Network error starting Google connection");
        }
    };

    const handleUpdateConfig = async (enabled: boolean) => {
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetchWithAuth(`${apiBase}/user/gmail/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gmail_enabled: enabled,
                    gmail_filter_query: filterQuery,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setSuccess("Settings updated successfully");
                setTimeout(() => setSuccess(""), 3000);
            } else {
                setError("Failed to update settings");
            }
        } catch (err) {
            setError("Network error updating settings");
        } finally {
            setSaving(false);
        }
    };

    const handleStartEditUsername = () => {
        setNewUsername(user?.username || "");
        setEditingUsername(true);
        setError("");
        setSuccess("");
    };

    const handleCancelEditUsername = () => {
        setEditingUsername(false);
        setNewUsername("");
        setError("");
    };

    const handleSaveUsername = async () => {
        if (!newUsername.trim()) {
            setError("Username cannot be empty");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetchWithAuth(`${apiBase}/user/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: newUsername.trim() }),
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setSuccess("Username updated successfully");
                setEditingUsername(false);
                setNewUsername("");
                setTimeout(() => setSuccess(""), 3000);
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to update username");
            }
        } catch (err) {
            setError("Network error updating username");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PageLoading text="Loading profile..." />;

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
            <h1 style={{ fontSize: "2rem", marginBottom: 30, color: "var(--text)" }}>Profile & Settings</h1>

            {error && <div className="error-message" style={{ marginBottom: 20 }}>{error}</div>}
            {success && <div className="success-message" style={{ marginBottom: 20 }}>{success}</div>}

            {/* Account Info */}
            <section className="dashboard-card" style={{ marginBottom: 30 }}>
                <h2>Account Information</h2>
                <div style={{ marginTop: 20 }}>
                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: "block", fontWeight: 500, marginBottom: 5, color: "var(--text-secondary)" }}>
                            Username
                        </label>
                        {editingUsername ? (
                            <div style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 400 }}>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username"
                                    className="input-field"
                                    style={{ flex: 1 }}
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
                                />
                                <button
                                    onClick={handleSaveUsername}
                                    disabled={saving}
                                    className="btn btn-primary"
                                    style={{ padding: "8px 16px", fontSize: "0.875rem" }}
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                                <button
                                    onClick={handleCancelEditUsername}
                                    className="btn btn-secondary"
                                    style={{ padding: "8px 16px", fontSize: "0.875rem" }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: "1rem", color: "var(--text)" }}>{user?.username}</span>
                                <button
                                    onClick={handleStartEditUsername}
                                    style={{
                                        background: "transparent",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-muted)",
                                        padding: "4px 10px",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: "0.75rem"
                                    }}
                                    title="Edit username"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label style={{ display: "block", fontWeight: 500, marginBottom: 5, color: "var(--text-secondary)" }}>
                            Email
                        </label>
                        <p style={{ color: "var(--text)" }}>{user?.email || "Not provided"}</p>
                    </div>
                </div>
            </section>

            {/* Gmail Integration */}
            <section className="dashboard-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: "1.5rem" }}>📧</span> Gmail Sync (Beta)
                        </h2>
                        <p style={{ color: "var(--text-muted)", marginTop: 5 }}>
                            Automatically fetch and process bank statements from your Gmail inbox.
                        </p>
                    </div>
                    {!user?.gmail_enabled && (
                        <button
                            className="btn btn-primary"
                            onClick={handleConnectGmail}
                            style={{ background: "#4285F4" }}
                        >
                            Connect Google Account
                        </button>
                    )}
                </div>

                {user?.gmail_enabled && (
                    <div style={{ marginTop: 30, paddingTop: 30, borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <div>
                                <label style={{ display: "block", fontWeight: "bold", marginBottom: 5 }}>Status</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }}></div>
                                    <span>Sync Active</span>
                                </div>
                            </div>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleUpdateConfig(false)}
                                disabled={saving}
                            >
                                Disconnect
                            </button>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: 10 }}>Search Filter</label>
                            <input
                                type="text"
                                className="input-field"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="e.g. from:examplebank.com has:attachment filename:pdf"
                            />
                            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 10 }}>
                                Only emails matching this Gmail search query will be processed.
                                Use common Gmail search operators.
                            </p>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleUpdateConfig(true)}
                                disabled={saving}
                            >
                                {saving ? "Saving..." : "Save Config"}
                            </button>
                        </div>

                        {user.gmail_last_sync && (
                            <div style={{ marginTop: 20, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                                Last Sync: {new Date(user.gmail_last_sync).toLocaleString()}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <style>{`
        .dashboard-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
        }
        .dashboard-card h2 {
            font-size: 1.25rem;
            font-weight: 600;
        }
        .input-field {
            width: 100%;
            padding: 12px;
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 1rem;
            outline: none;
        .input-field:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary {
            background: var(--accent);
            color: white;
            border: none;
        }
        .btn-primary:hover:not(:disabled) {
            background: var(--accent-hover);
        }
        .btn-secondary {
            background: var(--bg-input);
            color: var(--text-secondary);
            border: 1px solid var(--border);
        }
        .btn-secondary:hover {
            background: var(--bg-card);
            border-color: var(--accent);
        }
        .btn-danger {
            background: transparent;
            color: var(--danger);
            border: 1px solid var(--danger);
        }
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.1);
        }
        }
        .input-field:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary {
            background: var(--accent);
            color: white;
            border: none;
        }
        .btn-primary:hover:not(:disabled) {
            background: var(--accent-hover);
        }
        .btn-secondary {
            background: var(--bg-input);
            color: var(--text-secondary);
            border: 1px solid var(--border);
        }
        .btn-secondary:hover {
            background: var(--bg-card);
            border-color: var(--accent);
        }
        .btn-danger {
            background: transparent;
            color: var(--danger);
            border: 1px solid var(--danger);
        }
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.1);
        }
        .success-message {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .error-message {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
      `}</style>
        </div>
    );
}

export default Profile;
