import Dashboard from "../components/dashboard/Dashboard";
import PageHeader from "../components/layout/PageHeader";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh?: () => void;
  onCategorySelect?: (categoryId: number) => void;
};

export default function DashboardPage({ apiBase, refreshKey, onRefresh, onCategorySelect }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Dashboard"
        description="Your financial overview at a glance"
      />
      <Dashboard
        apiBase={apiBase}
        refreshKey={refreshKey}
        onRefresh={onRefresh}
        onCategorySelect={onCategorySelect}
      />
    </div>
  );
}