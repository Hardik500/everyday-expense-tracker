import Upload from "../components/Upload";
import PageHeader from "../components/PageHeader";

type Props = {
  apiBase: string;
  onDone: () => void;
};

export default function UploadPage({ apiBase, onDone }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Import Statement"
        description="Upload bank statements, credit card bills, or cash records"
      />
      <Upload apiBase={apiBase} onDone={onDone} />
    </div>
  );
}