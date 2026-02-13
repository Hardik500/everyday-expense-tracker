import Cards from "../components/Cards";
import PageHeader from "../components/PageHeader";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh?: () => void;
};

export default function CardsPage({ apiBase, refreshKey, onRefresh }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Credit Cards"
        description="Spending breakdown and statement coverage by card"
      />
      <Cards apiBase={apiBase} refreshKey={refreshKey} onRefresh={onRefresh} />
    </div>
  );
}