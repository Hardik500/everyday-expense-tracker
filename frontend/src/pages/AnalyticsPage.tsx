import Analytics from "../components/Analytics";
import PageHeader from "../components/PageHeader";
import type { Category, Subcategory } from "../App";

type Props = {
  apiBase: string;
  refreshKey: number;
  initialCategoryId?: number | null;
  categories?: Category[];
  subcategories?: Subcategory[];
  onRefresh?: () => void;
};

export default function AnalyticsPage({
  apiBase,
  refreshKey,
  initialCategoryId,
  categories,
  subcategories,
  onRefresh,
}: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Analytics"
        description="Visualize your income and expenses over time"
      />
      <Analytics
        apiBase={apiBase}
        refreshKey={refreshKey}
        initialCategoryId={initialCategoryId}
        categories={categories}
        subcategories={subcategories}
        onRefresh={onRefresh}
      />
    </div>
  );
}