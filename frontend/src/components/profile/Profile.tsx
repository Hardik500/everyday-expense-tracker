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

    // Backup/Restore states
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);

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

    // ====== BACKUP/RESTORE HANDLERS ======
    const handleExportBackup = async () => {
        setExporting(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetchWithAuth(`${apiBase}/backup/export`);
            if (res.ok) {
                const result = await res.json();
                // Download as JSON file
                const data = result.data || result;
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `expense-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setSuccess(`Backup exported! ${data.transactions?.length || 0} transactions, ${data.accounts?.length || 0} accounts`);
                setTimeout(() => setSuccess(""), 5000);
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to export backup");
            }
        } catch (err) {
            setError("Network error exporting backup");
        } finally {
            setExporting(false);
        }
    };

    const handleImportBackup = async () => {
        if (!importFile) {
            setError("Please select a file first");
            return;
        }

        setImporting(true);
        setError("");
        setSuccess("");
        try {
            const text = await importFile.text();
            const backupData = JSON.parse(text);

            const res = await fetchWithAuth(`${apiBase}/backup/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(backupData),
            });

            if (res.ok) {
                const result = await res.json();
                setSuccess(`Backup imported! ${result.imported?.transactions || 0} transactions, ${result.imported?.accounts || 0} accounts`);
                setImportFile(null);
                setTimeout(() => setSuccess(""), 5000);
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to import backup");
            }
        } catch (err) {
            if (err instanceof SyntaxError) {
                setError("Invalid backup file format");
            } else {
                setError("Network error importing backup");
            }
        } finally {
            setImporting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith(".json")) {
                setError("Please select a JSON file");
                return;
            }
            setImportFile(file);
            setError("");
        }
    };

    if (loading) return <PageLoading text="Loading profile..." />;

    return (
        <div className="max-w-3xl mx-auto px-5 py-10">
            <h1 className="text-3xl mb-8 text-text">Profile & Settings</h1>

            {error && <div className="error-message mb-5">{error}</div>}
            {success && <div className="success-message mb-5">{success}</div>}

            {/* Account Info */}
            <section className="bg-bg-card border border-border rounded-xl p-6 mb-8">
                <h2 className="text-xl font-semibold">Account Information</h2>
                <div className="mt-5">
                    <div className="mb-4">
                        <label className="block font-medium mb-1.5 text-text-secondary">
                            Username
                        </label>
                        {editingUsername ? (
                            <div className="flex gap-2.5 items-center max-w-md">
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username"
                                    className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text text-sm focus:outline-none focus:border-accent"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
                                />
                                <button
                                    onClick={handleSaveUsername}
                                    disabled={saving}
                                    className="px-4 py-2 bg-accent text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                                <button
                                    onClick={handleCancelEditUsername}
                                    className="px-4 py-2 bg-bg-input text-text-secondary border border-border rounded-lg font-medium text-sm hover:bg-bg-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <span className="text-base text-text">{user?.username}</span>
                                <button
                                    onClick={handleStartEditUsername}
                                    className="bg-transparent border border-border text-text-muted px-2.5 py-1 rounded cursor-pointer text-xs hover:text-text-primary"
                                    title="Edit username"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block font-medium mb-1.5 text-text-secondary">
                            Email
                        </label>
                        <p className="text-text">{user?.email || "Not provided"}</p>
                    </div>
                </div>
            </section>

            {/* Gmail Integration */}
            <section className="bg-bg-card border border-border rounded-xl p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="flex items-center gap-2.5 text-xl font-semibold">
                            <span className="text-2xl">📧</span> Gmail Auto-Import
                        </h2>
                        <p className="text-text-muted mt-1">
                            {user?.gmail_enabled
                                ? "Your Gmail is connected. Bank statement emails are automatically imported."
                                : "Connect your Gmail to automatically detect and import bank statements from email."}
                        </p>
                    </div>
                    {!user?.gmail_enabled && (
                        <button
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 whitespace-nowrap"
                            onClick={handleConnectGmail}
                        >
                            Connect Gmail
                        </button>
                    )}
                </div>

                {user?.gmail_enabled && (
                    <div className="mt-8 pt-8 border-t border-border">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <label className="block font-bold mb-1.5">Connection Status</label>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                    <span>Connected &amp; Syncing</span>
                                </div>
                            </div>
                            <button
                                className="px-4 py-2 bg-transparent text-danger border border-danger rounded-lg font-medium hover:bg-danger/10"
                                onClick={() => handleUpdateConfig(false)}
                                disabled={saving}
                            >
                                Disable Sync
                            </button>
                        </div>

                        <div className="mb-5">
                            <label className="block font-bold mb-2.5">Email Filter</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text focus:outline-none focus:border-accent"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="e.g. from:alerts@hdfcbank.net has:attachment filename:pdf"
                            />
                            <p className="text-sm text-text-muted mt-2.5">
                                Customize which emails are scanned for statements using Gmail search syntax.
                                Leave blank to scan all emails with PDF attachments.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2.5">
                            <button
                                className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                                onClick={() => handleUpdateConfig(true)}
                                disabled={saving}
                            >
                                {saving ? "Saving..." : "Save Settings"}
                            </button>
                        </div>

                        {user.gmail_last_sync && (
                            <div className="mt-5 text-sm text-text-muted">
                                Last synced: {new Date(user.gmail_last_sync).toLocaleString()}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Data Backup/Restore */}
            <section className="bg-bg-card border border-border rounded-xl p-6 mt-8">
                <h2 className="flex items-center gap-2.5 text-xl font-semibold">
                    <span className="text-2xl">💾</span> Data Backup
                </h2>
                <p className="text-text-muted mt-1 mb-6">
                    Export your data as JSON or restore from a previous backup.
                </p>

                <div className="grid grid-cols-2 gap-6">
                    {/* Export Section */}
                    <div className="p-5 bg-bg-input rounded-lg">
                        <h3 className="text-base font-semibold mb-2">Export Backup</h3>
                        <p className="text-sm text-text-muted mb-4">
                            Download all your transactions, accounts, categories, rules, and goals as a JSON file.
                        </p>
                        <button
                            className="w-full px-4 py-2 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                            onClick={handleExportBackup}
                            disabled={exporting}
                        >
                            {exporting ? "Exporting..." : "Export Backup"}
                        </button>
                    </div>

                    {/* Import Section */}
                    <div className="p-5 bg-bg-input rounded-lg">
                        <h3 className="text-base font-semibold mb-2">Restore Data</h3>
                        <p className="text-sm text-text-muted mb-4">
                            Import from a backup file. Existing data with matching IDs will be skipped.
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            id="import-file"
                            className="hidden"
                        />
                        <label htmlFor="import-file" className="block w-full px-4 py-2 bg-bg-input text-text-secondary border border-border rounded-lg font-medium text-center cursor-pointer mb-3 hover:bg-bg-hover">
                            {importFile ? importFile.name : "Choose File"}
                        </label>
                        {importFile && (
                            <button
                                className="w-full px-4 py-2 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                                onClick={handleImportBackup}
                                disabled={importing}
                            >
                                {importing ? "Importing..." : "Import Backup"}
                            </button>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Profile;
