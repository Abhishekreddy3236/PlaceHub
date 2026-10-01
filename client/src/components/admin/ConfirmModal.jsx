import React, { useEffect, useMemo, useState } from 'react';
import Loader from '../common/Loader';

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  requireText = '',
  onConfirm,
  onCancel,
}) {
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (open) {
      setTypedText('');
    }
  }, [open, requireText]);

  const canConfirm = useMemo(() => {
    return !requireText || typedText.trim() === requireText;
  }, [requireText, typedText]);

  if (!open) {
    return null;
  }

  const confirmClass =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
      : 'bg-red-600 hover:bg-red-700 focus:ring-red-500';

  const handleConfirm = () => {
    if (!canConfirm || loading) {
      return;
    }

    onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>

          {requireText ? (
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Type {requireText} to continue
              </label>
              <input
                value={typedText}
                onChange={(event) => setTypedText(event.target.value)}
                className="input w-full text-sm"
                autoComplete="off"
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !canConfirm}
            className={`${confirmClass} inline-flex min-w-28 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {loading ? <Loader size="sm" label="" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ConfirmModal);
