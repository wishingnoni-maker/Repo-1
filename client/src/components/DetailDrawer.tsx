import { useEffect, type ReactNode } from "react";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function DetailDrawer({ open, onClose, title, subtitle, children, footer }: DetailDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="detail-drawer-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="detail-drawer__header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="detail-drawer__body">{children}</div>
        {footer ? <div className="detail-drawer__footer">{footer}</div> : null}
      </aside>
    </div>
  );
}
