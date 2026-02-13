import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  extra?: ReactNode;
};

export default function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <header style={{ marginBottom: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>{title}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {description}
          </p>
        </div>
        {extra && <div>{extra}</div>}
      </div>
    </header>
  );
}