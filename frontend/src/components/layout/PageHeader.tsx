import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  extra?: ReactNode;
};

export default function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="mb-1">{title}</h1>
          <p className="text-text-muted text-sm">{description}</p>
        </div>
        {extra && <div>{extra}</div>}
      </div>
    </header>
  );
}
