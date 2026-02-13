import Profile from "../components/Profile";
import PageHeader from "../components/PageHeader";

type Props = {
  apiBase: string;
};

export default function ProfilePage({ apiBase }: Props) {
  return (
    <div className="page-transition-scale" style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader
        title="Profile & Settings"
        description="Manage your account and automated integrations"
      />
      <Profile apiBase={apiBase} />
    </div>
  );
}