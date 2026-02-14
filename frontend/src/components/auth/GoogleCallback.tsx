/* eslint-disable */
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";

type Props = {
    apiBase: string;
};

function GoogleCallback({ apiBase }: Props) {
    const [status, setStatus] = useState("Processing authorization...");
    const [error, setError] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (!code) {
            setError("No authorization code found in URL.");
            return;
        }

        fetchWithAuth(`${apiBase}/auth/google/callback?code=${code}`)
            .then(async (res) => {
                if (res.ok) {
                    setStatus("Success! Gmail connected. Redirecting...");
                    setTimeout(() => {
                        window.location.href = "/?tab=profile";
                    }, 2000);
                } else {
                    const data = await res.json();
                    setError(data.detail || "Failed to complete Google authorization.");
                }
            })
            .catch((err) => {
                setError("Network error during Google authorization.");
            });
    }, [apiBase]);

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-app)",
            color: "var(--text)"
        }}>
            <div className="dashboard-card" style={{ textAlign: "center", minWidth: 300 }}>
                {error ? (
                    <>
                        <div style={{ fontSize: "3rem", marginBottom: 20 }}>❌</div>
                        <h2 style={{ color: "#ef4444" }}>Authorization Failed</h2>
                        <p style={{ marginTop: 10, color: "var(--text-muted)" }}>{error}</p>
                        <button
                            className="btn btn-secondary"
                            style={{ marginTop: 20 }}
                            onClick={() => window.location.href = "/?tab=profile"}
                        >
                            Back to Profile
                        </button>
                    </>
                ) : (
                    <>
                        <div className="loader" style={{ marginBottom: 20 }}></div>
                        <h2>Connecting to Google</h2>
                        <p style={{ marginTop: 10, color: "var(--text-muted)" }}>{status}</p>
                    </>
                )}
            </div>

            <style>{`
        .dashboard-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .loader {
            border: 4px solid var(--border);
            border-top: 4px solid var(--accent);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}

export default GoogleCallback;
