import { useState, useEffect } from 'react';

function DeliveryEmailModal({
  open,
  title = 'Send Credentials',
  description = '',
  confirmLabel = 'Send',
  loading = false,
  defaultEmail = '',
  onSubmit,
  onCancel,
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || '');
      setError('');
    }
  }, [open, defaultEmail]);

  if (!open) return null;

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError('Enter a valid email address');
      return;
    }
    setError('');
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {description && (
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            )}
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Delivery email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="input w-full text-sm"
                placeholder="email@example.com"
                autoComplete="email"
                autoFocus
                required
              />
              {error && (
                <p className="mt-1.5 text-sm text-red-600">{error}</p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Credentials will be sent to this email. This is NOT used for login.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-w-28 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeliveryEmailModal;
