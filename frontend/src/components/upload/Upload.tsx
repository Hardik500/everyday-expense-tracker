import { useEffect, useState, useRef } from "react";
import { fetchWithAuth } from "../../utils/api";
import Select from "../ui/Select";

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
  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="opacity-50">
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
    fetchWithAuth(`${apiBase}/accounts`)
      .then((res) => res.json())
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [apiBase]);

  const createAccount = async () => {
    if (!accountName) {
      setStatus({ type: "error", message: "Account name is required." });
      return;
    }
    const response = await fetchWithAuth(`${apiBase}/accounts`, {
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
    const updatedAccounts = await fetchWithAuth(`${apiBase}/accounts`).then((res) => res.json());
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
    const response = await fetchWithAuth(`${apiBase}/ingest`, {
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
    setStatus({ type: "", message: "" });

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

      const response = await fetchWithAuth(`${apiBase}/detect-account`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.detected_account_id) {
          setAccountId(String(data.detected_account_id));
          setStatus({ type: 'success', message: `Matched existing account: ${data.detected_account_name}` });
          if (data.detected_profile) {
            setProfile(data.detected_profile);
          }
        } else if (data.suggested_name) {
          // New flow: Suggest creating a new account
          setAccountName(data.suggested_name);
          setAccountType(data.suggested_type || "bank");
          setShowNewAccount(true);
          setStatus({
            type: 'success',
            message: `Detected ${data.suggested_name}. We've pre-filled the account details for you below.`
          });
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
    <div className="grid gap-6">
      {/* Account Selection Card */}
      <div className="card">
        <div className="card-header">
          <h2>Select Account</h2>
          <button
            className="ghost text-xs"
            onClick={() => setShowNewAccount(!showNewAccount)}
          >
            {showNewAccount ? "Cancel" : "+ New Account"}
          </button>
        </div>

        {showNewAccount && (
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 mb-5 p-4 bg-bg-input rounded-lg">
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account name (e.g., HDFC Savings)"
              className="bg-bg-card"
            />
            <Select
              value={accountType}
              onChange={(val) => setAccountType(String(val))}
              options={[
                { value: "bank", label: "Bank" },
                { value: "card", label: "Card" },
                { value: "cash", label: "Cash" },
              ]}
              className="w-[140px]"
            />
            <button className="primary" onClick={createAccount}>
              Add
            </button>
          </div>
        )}

        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setAccountId(String(account.id))}
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer text-left transition-all ${accountId === String(account.id) ? "bg-accent-glow border-accent" : "bg-bg-input border-border-color"}`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${accountId === String(account.id) ? "bg-accent text-white" : "bg-bg-card text-text-muted"}`}
              >
                <AccountTypeIcon type={account.type} />
              </div>
              <div>
                <div className="font-medium text-text-primary text-sm">
                  {account.name}
                </div>
                <div className="text-xs text-text-muted capitalize">
                  {account.type}
                </div>
              </div>
            </button>
          ))}
          {accounts.length === 0 && (
            <p className="text-text-muted text-sm">
              No accounts yet. Create one above to get started.
            </p>
          )}
        </div>
      </div>

      {/* File Upload Card */}
      <div className="card">
        <div className="card-header">
          <h2>Upload Statement</h2>
          <div className="flex gap-2">
            {Object.entries(formatMap).map(([key, label]) => (
              <button
                key={key}
                className={`${source === key ? "primary" : "secondary"} px-3 py-1.5 text-xs`}
                onClick={() => setSource(key)}
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
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragActive ? "border-accent bg-accent-glow" : "border-border-color bg-bg-input"}`}
        >
          <FileIcon />
          <p className="mt-4 text-text-primary font-medium">
            {file ? file.name : "Drop your file here or click to browse"}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB`
              : `Supports ${formatMap[source]} files`}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
            accept=".csv,.txt,.pdf,.xls,.xlsx,.ofx,.qfx"
          />
        </div>

        {/* Profile selector (advanced) */}
        <details className="mt-4">
          <summary className="cursor-pointer text-text-muted text-xs">
            Advanced options
          </summary>
          <div className="mt-3">
            <label className="block mb-1.5 text-xs text-text-secondary">
              Bank Profile
            </label>
            <input
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="generic"
              className="max-w-[200px]"
            />
          </div>
        </details>

        {/* Status message */}
        {status.message && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-sm border ${
              status.type === "success"
                ? "bg-green-500/10 text-success border-green-500/30"
                : status.type === "error"
                  ? "bg-red-500/10 text-danger border-red-500/30"
                  : "bg-bg-input text-text-secondary border-border-color"
            }`}
          >
            {status.type === "loading" && (
              <span className="loading mr-2">
                ◌
              </span>
            )}
            {status.message}
          </div>
        )}

        {/* Submit button */}
        <div className="mt-5 flex justify-end">
          <button
            className="primary min-w-[140px]"
            onClick={submit}
            disabled={!file || !accountId || status.type === "loading"}
          >
            {status.type === "loading" ? "Processing..." : "Import Statement"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Upload;