import RulesManager from "../components/rules/RulesManager";
import PageHeader from "../components/layout/PageHeader";
import type { Category, Subcategory } from "../types";

type Props = {
  apiBase: string;
  categories: Category[];
  subcategories: Subcategory[];
  refreshKey: number;
  onRefresh: () => void;
};

export default function RulesPage({
  apiBase,
  categories,
  subcategories,
  refreshKey,
  onRefresh,
}: Props) {
  return (
    <div className="page-transition-scale grid gap-6">
      <PageHeader
        title="Categorization Rules"
        description="Manage rules for automatic transaction categorization"
      />
      <RulesManager
        apiBase={apiBase}
        categories={categories}
        subcategories={subcategories}
        refreshKey={refreshKey}
        onRefresh={onRefresh}
      />
    </div>
  );
}
