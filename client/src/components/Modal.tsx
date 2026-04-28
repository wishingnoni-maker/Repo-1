import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: "default" | "wide";
}

export function Modal({ title, open, onClose, children, width = "default" }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`modal-card modal-card--${width}`}>
        <div className="modal-card__header">
          <h3>{title}</h3>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
}
