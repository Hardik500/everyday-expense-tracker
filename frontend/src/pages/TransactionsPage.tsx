import Transactions from "../components/transactions/Transactions";
import PageHeader from "../components/layout/PageHeader";
import type { Category, Subcategory } from "../types";

type Props = {
  apiBase: string;
  categories: Category[];
  subcategories: Subcategory[];
  refreshKey: number;
  onUpdated: () => void;
};

export default function TransactionsPage({
  apiBase,
  categories,
  subcategories,
  refreshKey,
  onUpdated,
}: Props) {
  return (
    <div className="page-transition-scale grid gap-6">
      <PageHeader
        title="Transaction History"
        description="View and filter all your transactions"
      />
      <Transactions
        apiBase={apiBase}
        categories={categories}
        subcategories={subcategories}
        refreshKey={refreshKey}
        onUpdated={onUpdated}
      />
    </div>
  );
}
