import AccountManager from "../components/AccountManager";
import PageHeader from "../components/PageHeader";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
};

export default function AccountsPage({ apiBase, refreshKey, onRefresh }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Accounts"
        description="Manage your bank accounts, credit cards, and cash wallets"
      />
      <AccountManager apiBase={apiBase} refreshKey={refreshKey} onRefresh={onRefresh} />
    </div>
  );
}