/* eslint-disable */
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CategoriesProvider, useCategories } from "./contexts/CategoriesContext";
import { PageLoading } from "./components/ui/Loading";
import { ApiErrorToast } from "./components/common/ApiErrorToast";
import { useReviewCount } from "./hooks/useApiData";
import Layout from "./components/layout/Layout";
import PullToRefreshIndicator from "./components/common/PullToRefreshIndicator";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

// Lazy load pages for better performance
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CardsPage = lazy(() => import("./pages/CardsPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const RecurringPage = lazy(() => import("./pages/RecurringPage"));
const UploadPage = lazy(() => import("./pages/UploadPage"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

// Auth pages
import Login from "./components/auth/Login";
import LandingPage from "./components/auth/LandingPage";
import ResetPassword from "./components/auth/ResetPassword";
import GoogleCallback from "./components/auth/GoogleCallback";
import FloatingActionButton from "./components/layout/FloatingActionButton";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Loading fallback for lazy-loaded routes
function PageLoader() {
  return <PageLoading text="Loading..." />;
}

// Main app content with routing and auth
function AppContent() {
  const { user, token, isLoading, logout } = useAuth();
  const { categories, subcategories, refreshCategories } = useCategories();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<{
    message: string;
    status?: number;
    endpoint?: string;
    recoverable: boolean;
  } | null>(null);

  // Fetch review count using SWR (must be called unconditionally at top of component)
  // Pass null when not authenticated to prevent the request
  const { data: reviewData } = useReviewCount(token && user ? API_BASE : null);
  const reviewCount = Array.isArray(reviewData) ? reviewData.length : 0;

  // Pull-to-refresh hook
  const handleRefresh = useCallback(async () => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { containerRef: _unusedContainerRef, isPulling, pullProgress, isRefreshing, pullY } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 120,
    maxPullDistance: 180,
  });

  // Handle backward compatibility: convert ?tab=xxx to /xxx routes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && location.pathname === "/") {
      // Redirect old ?tab= URLs to new / URLs
      searchParams.delete("tab");
      navigate(
        {
          pathname: `/${tab}`,
          search: searchParams.toString(),
        },
        { replace: true }
      );
    }
  }, [searchParams, location.pathname, navigate]);

  // Handle category select from dashboard
  const handleCategorySelect = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    navigate("/analytics", { state: { categoryId } });
  };

  // Handle transactions filter
  const handleTransactionsFilter = (filter: {
    categoryId?: number;
    subcategoryId?: number;
  }) => {
    const params = new URLSearchParams();
    if (filter.categoryId) params.set("cat", filter.categoryId.toString());
    if (filter.subcategoryId) params.set("sub", filter.subcategoryId.toString());
    navigate(`/transactions?${params.toString()}`);
  };

  // Handle upload done
  const handleUploadDone = () => {
    setRefreshKey((k) => k + 1);
    navigate("/review");
  };

  // Show loading state during auth
  if (isLoading) {
    return <PageLoading text="Authenticating..." />;
  }

  // Show login/landing page if not authenticated
  if (!token || !user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/google/callback" element={<GoogleCallback apiBase={API_BASE} />} />
        <Route path="/login" element={<Login apiBase={API_BASE} />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }


  // Authenticated routes with layout
  const handleLogOut = async () => {
    try {
      logout();
      // Navigate to landing page after logout
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <Layout
      reviewCount={reviewCount}
      user={user}
      onLogout={handleLogOut}
    >
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        isPulling={isPulling}
        pullProgress={pullProgress}
        isRefreshing={isRefreshing}
        pullY={pullY}
      />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
                onCategorySelect={handleCategorySelect}
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
                onCategorySelect={handleCategorySelect}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                initialCategoryId={selectedCategoryId}
                categories={categories}
                subcategories={subcategories}
                onRefresh={handleRefresh}
              />
            }
          />
          <Route
            path="/cards"
            element={
              <CardsPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
              />
            }
          />
          <Route
            path="/accounts"
            element={
              <AccountsPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
              />
            }
          />
          <Route
            path="/categories"
            element={
              <CategoriesPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                onRefresh={() => {
                  setRefreshKey((k) => k + 1);
                  refreshCategories();
                }}
                onViewTransactions={handleTransactionsFilter}
              />
            }
          />
          <Route
            path="/rules"
            element={
              <RulesPage
                apiBase={API_BASE}
                categories={categories}
                subcategories={subcategories}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
              />
            }
          />
          <Route
            path="/recurring"
            element={
              <RecurringPage
                apiBase={API_BASE}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
              />
            }
          />
          <Route
            path="/upload"
            element={
              <UploadPage
                apiBase={API_BASE}
                onDone={handleUploadDone}
              />
            }
          />
          <Route
            path="/review"
            element={
              <ReviewPage
                apiBase={API_BASE}
                categories={categories}
                subcategories={subcategories}
                refreshKey={refreshKey}
                reviewCount={reviewCount}
                onUpdated={() => setRefreshKey((k) => k + 1)}
              />
            }
          />
          <Route
            path="/transactions"
            element={
              <TransactionsPage
                apiBase={API_BASE}
                categories={categories}
                subcategories={subcategories}
                refreshKey={refreshKey}
                onUpdated={() => setRefreshKey((k) => k + 1)}
              />
            }
          />
          <Route
            path="/profile"
            element={<ProfilePage apiBase={API_BASE} />}
          />
          {/* Handle Google callback when authenticated */}
          <Route
            path="/auth/google/callback"
            element={<GoogleCallback apiBase={API_BASE} />}
          />
          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>

      {/* Global API Error Toast */}
      <ApiErrorToast error={apiError} onDismiss={() => setApiError(null)} />
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <CategoriesProvider>
        <Router>
          <AppContent />
          <FloatingActionButton />
        </Router>
      </CategoriesProvider>
    </AuthProvider>
  );
}

export default App;
