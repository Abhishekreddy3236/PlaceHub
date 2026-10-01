import React, { useState, useEffect } from 'react';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, loading, isLoading, confirmText = 'Confirm', delay = 0 }) {
  const [countdown, setCountdown] = useState(delay);
  const isProcessing = loading || isLoading;

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900">{title || 'Confirm Action'}</h2>
          <p className="mt-2 text-slate-600">{message || 'Are you sure you want to proceed?'}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing || countdown > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : (countdown > 0 ? `${confirmText} (${countdown})` : confirmText)}
          </button>
        </div>
      </div>
    </div>
  );
}
