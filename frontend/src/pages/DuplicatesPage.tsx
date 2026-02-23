import { DuplicateDetection } from "../components/transactions/DuplicateDetection";
import PageHeader from "../components/layout/PageHeader";

type Props = {
  apiBase: string;
  onRefresh?: () => void;
};

export default function DuplicatesPage({ apiBase, onRefresh }: Props) {
  return (
    <div className="page-transition-scale grid gap-6">
      <PageHeader
        title="Duplicate Detection"
        description="Find and merge potential duplicate transactions"
      />
      <DuplicateDetection apiBase={apiBase} onRefresh={onRefresh} />
    </div>
  );
}
