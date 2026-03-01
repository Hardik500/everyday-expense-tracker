import { useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Props = {
    apiBase: string;
};

export default function OnboardingPage({ apiBase }: Props) {
    const navigate = useNavigate();
    const { user, token } = useAuth(); // Need token to force context refresh if we implemented a reload

    const [pan, setPan] = useState("");
    const [dob, setDob] = useState(""); // YYYY-MM-DD from input date
    const [name, setName] = useState(user?.full_name || "");
    const [cardLast4, setCardLast4] = useState("");

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleComplete = async (e: React.FormEvent | null, skip: boolean = false) => {
        if (e) e.preventDefault();

        setSaving(true);
        setError("");

        try {
            // Optional: convert YYYY-MM-DD to DDMMYYYY or DD-MM-YYYY if dob is provided
            // The backend pdf_unlock handles various formats, so we can just send what user types
            // If they use date picker, it's YYYY-MM-DD. Let's send DD/MM/YYYY or DD-MM-YYYY
            let formattedDob = dob;
            if (dob && dob.includes("-")) {
                const [y, m, d] = dob.split("-");
                formattedDob = `${d}-${m}-${y}`; // Indian format DD-MM-YYYY
            }

            const payload = skip ? {} : {
                pan: pan.toUpperCase(),
                dob: formattedDob,
                name: name,
                card_last_4: cardLast4
            };

            const res = await fetchWithAuth(`${apiBase}/user/onboarding`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if ((res as Response).ok) {
                // Force a reload to refresh AuthContext user state
                window.location.href = "/dashboard";
            } else {
                const data = await (res as Response).json();
                setError(data?.detail || "Failed to save details");
                setSaving(false);
            }
        } catch (err) {
            setError("Network error. Please try again.");
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-main p-5">
            <div className="w-full max-w-3xl bg-bg-card border border-border rounded-2xl p-8 shadow-xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-3 text-text">Welcome to ExpenseTracker! 🎉</h1>
                    <p className="text-text-muted">
                        To automatically import your bank statements, we need some standard details banks use to password-protect statement PDFs.
                    </p>
                </div>

                {error && (
                    <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={(e) => handleComplete(e, false)} className="space-y-6">
                    <div>
                        <label className="block font-medium mb-1.5 text-text-secondary">
                            PAN Number <span className="text-text-muted text-xs font-normal">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={pan}
                            onChange={(e) => setPan(e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-xl text-text focus:outline-none focus:border-accent uppercase"
                        />
                        <p className="text-xs text-text-muted mt-1.5">Commonly used by HDFC, ICICI, Kotak</p>
                    </div>

                    <div>
                        <label className="block font-medium mb-1.5 text-text-secondary">
                            Date of Birth <span className="text-text-muted text-xs font-normal">(Optional)</span>
                        </label>
                        <input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-xl text-text focus:outline-none focus:border-accent"
                        />
                        <p className="text-xs text-text-muted mt-1.5">Commonly used by Axis, SBI, HDFC</p>
                    </div>

                    <div>
                        <label className="block font-medium mb-1.5 text-text-secondary">
                            Full Name <span className="text-text-muted text-xs font-normal">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="As it appears on bank accounts"
                            className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-xl text-text focus:outline-none focus:border-accent"
                        />
                        <p className="text-xs text-text-muted mt-1.5">Commonly used by Kotak</p>
                    </div>

                    <div>
                        <label className="block font-medium mb-1.5 text-text-secondary">
                            Card Last 4 Digits <span className="text-text-muted text-xs font-normal">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={cardLast4}
                            onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                            placeholder="1234"
                            maxLength={4}
                            className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-xl text-text focus:outline-none focus:border-accent"
                        />
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {saving ? "Saving..." : "Save & Continue"}
                        </button>

                        <button
                            type="button"
                            onClick={(e) => handleComplete(e, true)}
                            disabled={saving}
                            className="w-full py-3 bg-transparent text-text-secondary rounded-xl font-medium hover:bg-bg-hover transition-colors"
                        >
                            Skip for now
                        </button>
                    </div>
                </form>

                <p className="text-xs text-center text-text-muted mt-6">
                    Your details are stored securely and only used to unlock your statement PDFs. You can always change or add more passwords in Settings.
                </p>
            </div>
        </div>
    );
}
