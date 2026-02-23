import CategoryManager from "../components/categories/CategoryManager";
import PageHeader from "../components/layout/PageHeader";
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
    <div className="page-transition-scale grid gap-6">
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
