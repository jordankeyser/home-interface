import { WarningIcon } from './icons';

/**
 * In-app confirmation.
 *
 * Replaces `window.confirm` / `window.alert`, which render as native Chromium
 * dialogs — tiny, unthemed, and awkward to dismiss by touch in kiosk mode.
 */
const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-6"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    aria-describedby={message ? 'confirm-dialog-message' : undefined}
  >
    <div className="card w-full max-w-md p-6">
      <div className="flex items-start gap-4">
        {destructive && (
          <WarningIcon className="mt-0.5 h-7 w-7 shrink-0 text-danger" />
        )}
        <div className="min-w-0">
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-fg">
            {title}
          </h3>
          {message && (
            <p id="confirm-dialog-message" className="mt-1.5 text-sm text-fg-muted">
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn btn-primary"
          style={
            destructive
              ? { backgroundColor: 'var(--danger)', color: '#fff' }
              : undefined
          }
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
