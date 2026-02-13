import ReviewQueue from "../components/ReviewQueue";
import PageHeader from "../components/PageHeader";
import type { Category, Subcategory } from "../App";

type Props = {
  apiBase: string;
  categories?: Category[];
  subcategories?: Subcategory[];
  refreshKey: number;
  reviewCount?: number;
  onUpdated?: () => void;
};

export default function ReviewPage({
  apiBase,
  categories,
  subcategories,
  refreshKey,
  reviewCount,
  onUpdated,
}: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Review Transactions"
        description={`${reviewCount || 0} transactions need your attention`}
      />
      <ReviewQueue
        apiBase={apiBase}
        categories={categories}
        subcategories={subcategories}
        refreshKey={refreshKey}
        onUpdated={onUpdated}
      />
    </div>
  );
}