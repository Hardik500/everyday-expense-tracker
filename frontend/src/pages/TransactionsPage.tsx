import Transactions from "../components/Transactions";
import PageHeader from "../components/PageHeader";
import type { Category, Subcategory } from "../App";

type Props = {
  apiBase: string;
  categories?: Category[];
  subcategories?: Subcategory[];
  refreshKey: number;
  onUpdated?: () => void;
};

export default function TransactionsPage({
  apiBase,
  categories,
  subcategories,
  refreshKey,
  onUpdated,
}: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
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