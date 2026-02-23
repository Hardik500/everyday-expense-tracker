import Upload from "../components/upload/Upload";
import PageHeader from "../components/layout/PageHeader";

type Props = {
  apiBase: string;
  onDone: () => void;
};

export default function UploadPage({ apiBase, onDone }: Props) {
  return (
    <div className="page-transition-scale grid gap-6">
      <PageHeader
        title="Import Statement"
        description="Upload bank statements, credit card bills, or cash records"
      />
      <Upload apiBase={apiBase} onDone={onDone} />
    </div>
  );
}
