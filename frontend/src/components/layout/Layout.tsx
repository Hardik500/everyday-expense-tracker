import { ReactNode, useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";

type Tab = "dashboard" | "analytics" | "cards" | "accounts" | "categories" | "rules" | "recurring" | "upload" | "review" | "transactions" | "profile" | "goals" | "duplicates";

type NavItem = {
  id: Tab;
  label: string;
  icon: JSX.Element;
};

type LayoutProps = {
  reviewCount?: number;
  user?: { full_name?: string; username?: string } | null;
  onLogout?: () => void;
  children?: ReactNode;
};

const NavIcon = ({ active, children }: { active: boolean; children: ReactNode }) => (
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

const navItems: NavItem[] = [
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
    id: "cards",
    label: "Cards",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "categories",
    label: "Categories",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    id: "rules",
    label: "Rules",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: "recurring",
    label: "Recurring",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
  {
    id: "goals",
    label: "Goals",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: "duplicates",
    label: "Duplicates",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function Layout({ reviewCount = 0, user, onLogout, children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Get current tab from pathname
  const getCurrentTab = (): Tab => {
    const path = location.pathname.slice(1); // Remove leading /
    const validTabs: Tab[] = ["dashboard", "analytics", "cards", "accounts", "categories", "rules", "recurring", "upload", "review", "transactions", "profile", "goals", "duplicates"];
    return validTabs.includes(path as Tab) ? (path as Tab) : "dashboard";
  };

  const activeTab = getCurrentTab();

  const handleNavClick = (tabId: Tab) => {
    // Skip if already on this tab - prevents unnecessary re-renders and re-fetches
    if (activeTab === tabId) return;

    // clear query params when navigating to a new tab (except for specific cases)
    const paramsToRemove = ["q", "cat", "sub", "range", "start", "end", "page", "id"];
    const searchParams = new URLSearchParams(location.search);
    paramsToRemove.forEach(p => searchParams.delete(p));

    navigate({
      pathname: `/${tabId}`,
      search: searchParams.toString() || undefined,
    });
  };

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
              onClick={() => handleNavClick(item.id)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: activeTab === item.id ? "default" : "pointer",
                position: "relative",
                opacity: activeTab === item.id ? 1 : 0.7,
              }}
              title={item.label}
            >
              <NavIcon active={activeTab === item.id}>{item.icon}</NavIcon>
              {item.id === "review" && reviewCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    padding: "0 4px",
                    borderRadius: 9,
                    background: "var(--danger)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--bg-secondary)",
                  }}
                >
                  {reviewCount > 99 ? "99+" : reviewCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12
        }}>
          <button
            onClick={() => navigate("/profile")}
            title={user?.full_name || user?.username || "Profile"}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: 'var(--bg-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeTab === "profile" ? '2px solid var(--accent)' : '1px solid var(--border-color)',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--accent)',
              cursor: 'pointer',
              padding: 0,
              transition: 'all var(--transition-fast)'
            }}
          >
            {(user?.full_name || user?.username || "?")?.[0].toUpperCase()}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          marginLeft: 72,
          flex: 1,
          padding: "2rem 2.5rem",
          overflowY: "auto",
          height: "100vh",
          position: "relative",
        }}
      >
        {children}
      </main>
    </div>
  );
}