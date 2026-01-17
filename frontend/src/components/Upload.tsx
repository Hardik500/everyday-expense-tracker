import { useEffect, useState, useRef } from "react";
import Select from "./ui/Select";

type Account = {
  id: number;
  name: string;
  type: string;
};

type Props = {
  apiBase: string;
  onDone: () => void;
};

const FileIcon = () => (
  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const AccountTypeIcon = ({ type }: { type: string }) => {
  if (type === "bank") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    );
  }
  if (type === "card") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
};

function Upload({ apiBase, onDone }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [source, setSource] = useState("csv");
  const [profile, setProfile] = useState("generic");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "loading" | ""; message: string }>({ type: "", message: "" });
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("bank");
  const [dragActive, setDragActive] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${apiBase}/accounts`)
      .then((res) => res.json())
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [apiBase]);

  const createAccount = async () => {
    if (!accountName) {
      setStatus({ type: "error", message: "Account name is required." });
      return;
    }
    const response = await fetch(`${apiBase}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName, type: accountType, currency: "INR" }),
    });
    if (!response.ok) {
      setStatus({ type: "error", message: "Failed to create account." });
      return;
    }
    setAccountName("");
    setShowNewAccount(false);
    setStatus({ type: "success", message: "Account created successfully!" });
    const updatedAccounts = await fetch(`${apiBase}/accounts`).then((res) => res.json());
    setAccounts(updatedAccounts);
  };

  const submit = async () => {
    if (!file || !accountId) {
      setStatus({ type: "error", message: "Please select an account and file." });
      return;
    }
    const form = new FormData();
    form.append("account_id", accountId);
    form.append("source", source);
    if (profile) {
      form.append("profile", profile);
    }
    form.append("file", file);
    setStatus({ type: "loading", message: "Processing your statement..." });
    const response = await fetch(`${apiBase}/ingest`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      setStatus({ type: "error", message: "Upload failed. Please check the file format." });
      return;
    }
    const data = await response.json();
    setStatus({ type: "success", message: `Successfully imported ${data.inserted} transactions (${data.skipped} duplicates skipped).` });
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => onDone(), 1500);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Auto-detect format and account from file content via backend
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);

    // Auto-detect format from extension
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') setSource('csv');
    else if (ext === 'txt') setSource('txt');
    else if (ext === 'pdf') setSource('pdf');
    else if (ext === 'xls' || ext === 'xlsx') setSource('xls');
    else if (ext === 'ofx' || ext === 'qfx') setSource('ofx');

    // Call backend to detect account from file content
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${apiBase}/detect-account`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.detected_account_id) {
          setAccountId(String(data.detected_account_id));
          setStatus({ type: 'success', message: `Auto-detected: ${data.detected_account_name}` });
          if (data.detected_profile) {
            setProfile(data.detected_profile);
          }
        }
      }
    } catch {
      // Ignore detection errors - user can still manually select
    }
  };

  const formatMap: Record<string, string> = {
    csv: "CSV",
    txt: "TXT",
    ofx: "OFX/QFX",
    xls: "Excel",
    pdf: "PDF",
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Account Selection Card */}
      <div className="card">
        <div className="card-header">
          <h2>Select Account</h2>
          <button
            className="ghost"
            onClick={() => setShowNewAccount(!showNewAccount)}
            style={{ fontSize: "0.8125rem" }}
          >
            {showNewAccount ? "Cancel" : "+ New Account"}
          </button>
        </div>

        {showNewAccount && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "0.75rem",
              marginBottom: "1.25rem",
              padding: "1rem",
              background: "var(--bg-input)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account name (e.g., HDFC Savings)"
              style={{ background: "var(--bg-card)" }}
            />
            <Select
              value={accountType}
              onChange={(val) => setAccountType(String(val))}
              options={[
                { value: "bank", label: "Bank" },
                { value: "card", label: "Card" },
                { value: "cash", label: "Cash" },
              ]}
              style={{ width: 140 }}
            />
            <button className="primary" onClick={createAccount}>
              Add
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setAccountId(String(account.id))}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "1rem",
                background: accountId === String(account.id) ? "var(--accent-glow)" : "var(--bg-input)",
                border: `1px solid ${accountId === String(account.id) ? "var(--accent)" : "var(--border-color)"}`,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all var(--transition-fast)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: accountId === String(account.id) ? "var(--accent)" : "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accountId === String(account.id) ? "#fff" : "var(--text-muted)",
                }}
              >
                <AccountTypeIcon type={account.type} />
              </div>
              <div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                  {account.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                  {account.type}
                </div>
              </div>
            </button>
          ))}
          {accounts.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No accounts yet. Create one above to get started.
            </p>
          )}
        </div>
      </div>

      {/* File Upload Card */}
      <div className="card">
        <div className="card-header">
          <h2>Upload Statement</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {Object.entries(formatMap).map(([key, label]) => (
              <button
                key={key}
                className={source === key ? "primary" : "secondary"}
                onClick={() => setSource(key)}
                style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? "var(--accent)" : "var(--border-color)"}`,
            borderRadius: "var(--radius-lg)",
            padding: "3rem 2rem",
            textAlign: "center",
            cursor: "pointer",
            background: dragActive ? "var(--accent-glow)" : "var(--bg-input)",
            transition: "all var(--transition-fast)",
          }}
        >
          <FileIcon />
          <p style={{ marginTop: "1rem", color: "var(--text-primary)", fontWeight: 500 }}>
            {file ? file.name : "Drop your file here or click to browse"}
          </p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {file
              ? `${(file.size / 1024).toFixed(1)} KB`
              : `Supports ${formatMap[source]} files`}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            style={{ display: "none" }}
            accept=".csv,.txt,.pdf,.xls,.xlsx,.ofx,.qfx"
          />
        </div>

        {/* Profile selector (advanced) */}
        <details style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
            Advanced options
          </summary>
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              Bank Profile
            </label>
            <input
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="generic"
              style={{ maxWidth: 200 }}
            />
          </div>
        </details>

        {/* Status message */}
        {status.message && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.875rem 1rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.875rem",
              background:
                status.type === "success"
                  ? "rgba(34, 197, 94, 0.1)"
                  : status.type === "error"
                    ? "rgba(239, 68, 68, 0.1)"
                    : "var(--bg-input)",
              color:
                status.type === "success"
                  ? "var(--success)"
                  : status.type === "error"
                    ? "var(--danger)"
                    : "var(--text-secondary)",
              border: `1px solid ${status.type === "success"
                ? "rgba(34, 197, 94, 0.3)"
                : status.type === "error"
                  ? "rgba(239, 68, 68, 0.3)"
                  : "var(--border-color)"
                }`,
            }}
          >
            {status.type === "loading" && (
              <span className="loading" style={{ marginRight: 8 }}>
                ◌
              </span>
            )}
            {status.message}
          </div>
        )}

        {/* Submit button */}
        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            className="primary"
            onClick={submit}
            disabled={!file || !accountId || status.type === "loading"}
            style={{ minWidth: 140 }}
          >
            {status.type === "loading" ? "Processing..." : "Import Statement"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Upload;
