import { DuplicateDetection } from "../components/transactions/DuplicateDetection";
import PageHeader from "../components/layout/PageHeader";

type Props = {
  apiBase: string;
  onRefresh?: () => void;
};

export default function DuplicatesPage({ apiBase, onRefresh }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Duplicate Detection"
        description="Find and merge potential duplicate transactions"
      />
      <DuplicateDetection apiBase={apiBase} onRefresh={onRefresh} />
    </div>
  );
}
