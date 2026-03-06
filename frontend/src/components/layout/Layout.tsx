import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Tab = "dashboard" | "analytics" | "accounts" | "categories" | "rules" | "recurring" | "upload" | "review" | "transactions" | "profile" | "goals" | "calendar" | "email-imports" | "duplicates";

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
    className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all duration-150 ${active ? "bg-accent text-white" : "bg-transparent text-text-muted"
      }`}
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
    id: "accounts",
    label: "Accounts",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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
    id: "calendar",
    label: "Calendar",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "email-imports" as Tab,
    label: "Email Sync",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
    const validTabs: Tab[] = ["dashboard", "analytics", "accounts", "categories", "rules", "recurring", "upload", "review", "transactions", "profile", "goals", "calendar", "email-imports", "duplicates"];
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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-[72px] bg-bg-secondary border-r border-border-color flex flex-col items-center py-6 fixed top-0 left-0 bottom-0 z-50"
      >
        {/* Logo */}
        <div
          className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
        >
          <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`bg-transparent border-none p-0 relative transition-opacity ${activeTab === item.id ? "cursor-default opacity-100" : "cursor-pointer opacity-70 hover:opacity-100"
                }`}
              title={item.label}
            >
              <NavIcon active={activeTab === item.id}>{item.icon}</NavIcon>
              {item.id === "review" && reviewCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center border-2 border-bg-secondary"
                >
                  {reviewCount > 99 ? "99+" : reviewCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            title={user?.full_name || user?.username || "Profile"}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${activeTab === "profile"
                ? "bg-bg-primary border-2 border-accent text-accent"
                : "bg-bg-primary border border-border-color text-accent"
              }`}
          >
            {(user?.full_name || user?.username || "?")?.[0].toUpperCase()}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout"
              className="bg-transparent border-none text-text-muted cursor-pointer p-2 rounded-lg hover:text-danger transition-colors"
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
        className="ml-[72px] flex-1 p-8 overflow-y-auto h-screen relative"
      >
        {children}
      </main>
    </div>
  );
}
