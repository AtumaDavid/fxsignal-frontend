import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import { Spinner } from './Empty';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation dialog. Use this instead of window.confirm /
 * window.alert so the copy is readable, keyboard-safe and styled like the
 * rest of the app. Closes on Escape, backdrop click, or Cancel.
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="modal-head">
          <h2 id="confirm-title">{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <p id="confirm-message" className="modal-message">
          {message}
        </p>
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner />} {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
