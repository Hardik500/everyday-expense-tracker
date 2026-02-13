import RecurringExpenses from "../components/RecurringExpenses";
import PageHeader from "../components/PageHeader";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh?: () => void;
};

export default function RecurringPage({ apiBase, refreshKey, onRefresh }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Recurring Expenses"
        description="Track your recurring bills and subscriptions"
      />
      <RecurringExpenses
        apiBase={apiBase}
        refreshKey={refreshKey}
        onRefresh={onRefresh}
      />
    </div>
  );
}