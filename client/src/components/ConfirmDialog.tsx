import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p>{message}</p>
      <div className="row-actions">
        <button className="button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="button button--danger"
          onClick={async () => {
            await onConfirm();
            onCancel();
          }}
          type="button"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
