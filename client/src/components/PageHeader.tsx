import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <section className="panel page-header">
      <div className="page-header__top">
        <div className="page-header__copy">
          {eyebrow ? <p className="page-kicker">{eyebrow}</p> : null}
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
      {children ? <div className="page-header__body">{children}</div> : null}
    </section>
  );
}
