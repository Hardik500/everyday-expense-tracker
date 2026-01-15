import { useEffect, useState } from "react";
import Upload from "./components/Upload";
import Transactions from "./components/Transactions";
import ReviewQueue from "./components/ReviewQueue";
import Reports from "./components/Reports";
import Analytics from "./components/Analytics";

const API_BASE = "http://localhost:8000";

export type Category = {
  id: number;
  name: string;
};

export type Subcategory = {
  id: number;
  category_id: number;
  name: string;
};

export type Transaction = {
  id: number;
  account_id: number;
  posted_at: string;
  amount: number;
  currency: string;
  description_raw: string;
  description_norm: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  is_uncertain: boolean;
};

type Tab = "dashboard" | "analytics" | "upload" | "review" | "transactions";

const NavIcon = ({ active, children }: { active: boolean; children: React.ReactNode }) => (
  <div
    style={{
      width: 40,
      height: 40,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? "var(--accent)" : "transparent",
      color: active ? "#fff" : "var(--text-muted)",
      transition: "all var(--transition-fast)",
    }}
  >
    {children}
  </div>
);

function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories || []);
        setSubcategories(data.subcategories || []);
      })
      .catch(() => {
        setCategories([]);
        setSubcategories([]);
      });
  }, [refreshKey]);

  useEffect(() => {
    fetch(`${API_BASE}/transactions?uncertain=true`)
      .then((res) => res.json())
      .then((data) => setReviewCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setReviewCount(0));
  }, [refreshKey]);

  const navItems: { id: Tab; label: string; icon: JSX.Element }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "upload",
      label: "Import",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      id: "review",
      label: "Review",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "transactions",
      label: "History",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 72,
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "1.5rem 0",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent) 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "2rem",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                position: "relative",
              }}
              title={item.label}
            >
              <NavIcon active={activeTab === item.id}>{item.icon}</NavIcon>
              {item.id === "review" && reviewCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--danger)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {reviewCount > 99 ? "99+" : reviewCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main
        style={{
          marginLeft: 72,
          flex: 1,
          padding: "2rem 2.5rem",
          maxWidth: 1400,
        }}
      >
        {/* Header */}
        <header style={{ marginBottom: "2rem" }}>
          <h1 style={{ marginBottom: 4 }}>
            {activeTab === "dashboard" && "Dashboard"}
            {activeTab === "analytics" && "Analytics"}
            {activeTab === "upload" && "Import Statement"}
            {activeTab === "review" && "Review Transactions"}
            {activeTab === "transactions" && "Transaction History"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {activeTab === "dashboard" && "Your financial overview at a glance"}
            {activeTab === "analytics" && "Visualize your income and expenses over time"}
            {activeTab === "upload" && "Upload bank statements, credit card bills, or cash records"}
            {activeTab === "review" && `${reviewCount} transactions need your attention`}
            {activeTab === "transactions" && "View and filter all your transactions"}
          </p>
        </header>

        {/* Tab content */}
        <div className="animate-in">
          {activeTab === "dashboard" && (
            <Reports apiBase={API_BASE} refreshKey={refreshKey} />
          )}
          {activeTab === "analytics" && (
            <Analytics apiBase={API_BASE} refreshKey={refreshKey} />
          )}
          {activeTab === "upload" && (
            <Upload
              apiBase={API_BASE}
              onDone={() => {
                setRefreshKey((k) => k + 1);
                setActiveTab("review");
              }}
            />
          )}
          {activeTab === "review" && (
            <ReviewQueue
              apiBase={API_BASE}
              categories={categories}
              subcategories={subcategories}
              refreshKey={refreshKey}
              onUpdated={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {activeTab === "transactions" && (
            <Transactions
              apiBase={API_BASE}
              categories={categories}
              subcategories={subcategories}
              refreshKey={refreshKey}
              onUpdated={() => setRefreshKey((k) => k + 1)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
