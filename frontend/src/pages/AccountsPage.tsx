import AccountManager from "../components/accounts/AccountManager";
import Cards from "../components/accounts/Cards";
import PageHeader from "../components/layout/PageHeader";

type Props = {
  apiBase: string;
  refreshKey: number;
  onRefresh: () => void;
};

export default function AccountsPage({ apiBase, refreshKey, onRefresh }: Props) {
  return (
    <div className="page-transition-scale grid gap-6">
      <PageHeader
        title="Accounts"
        description="Manage your bank accounts, credit cards, and cash wallets"
      />
      <AccountManager apiBase={apiBase} refreshKey={refreshKey} onRefresh={onRefresh} />
      <Cards apiBase={apiBase} refreshKey={refreshKey} onRefresh={onRefresh} />
    </div>
  );
}
