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
            .catch(() => {
                setError("Network error during Google authorization.");
            });
    }, [apiBase]);

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-bg-app text-text">
            <div className="bg-bg-card border border-border rounded-xl p-10 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] text-center min-w-[300px]">
                {error ? (
                    <>
                        <div className="text-[3rem] mb-5">❌</div>
                        <h2 className="text-red-500">Authorization Failed</h2>
                        <p className="mt-2.5 text-text-muted">{error}</p>
                        <button
                            className="btn btn-secondary mt-5"
                            onClick={() => window.location.href = "/?tab=profile"}
                        >
                            Back to Profile
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-5"></div>
                        <h2>Connecting to Google</h2>
                        <p className="mt-2.5 text-text-muted">{status}</p>
                    </>
                )}
            </div>
        </div>
    );
}

export default GoogleCallback;