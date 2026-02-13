import CategoryManager from "../components/CategoryManager";
import PageHeader from "../components/PageHeader";
import type { Category, Subcategory } from "../types";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
  onViewTransactions: (filter: { categoryId?: number; subcategoryId?: number }) => void;
};

export default function CategoriesPage({
  apiBase,
  refreshKey,
  onRefresh,
  onViewTransactions,
}: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Categories"
        description="Organize your transactions with categories and subcategories"
      />
      <CategoryManager
        apiBase={apiBase}
        refreshKey={refreshKey}
        onRefresh={onRefresh}
        onViewTransactions={onViewTransactions}
      />
    </div>
  );
}