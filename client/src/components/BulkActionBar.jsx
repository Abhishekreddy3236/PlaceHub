import { useState, useEffect } from 'react';
import { HiArrowRight, HiXCircle, HiExclamationTriangle } from 'react-icons/hi2';

export default function BulkActionBar({
  selectedCount,
  onAction,
  onClear,
  loading = false,
  currentRound,
  roundName,
  nextRoundName,
  totalRounds,
  isFinalRound,
}) {
  const [showConfirm, setShowConfirm] = useState(null); // 'next_round' | 'reject' | null
  const [isAbsent, setIsAbsent] = useState(false);

  // Reset state when selection changes
  useEffect(() => {
    setShowConfirm(null);
    setIsAbsent(false);
  }, [selectedCount]);

  if (selectedCount === 0) return null;

  const handleConfirm = async () => {
    await onAction(showConfirm, { isAbsent });
    setShowConfirm(null);
  };

  const isPromote = showConfirm === 'next_round';

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-5 py-3.5 flex items-center justify-between z-50 font-sans transition-all duration-300">
      {showConfirm ? (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-sm font-medium text-slate-800">
                {isPromote
                  ? isFinalRound
                    ? `Select ${selectedCount} applicant(s)?`
                    : `Move ${selectedCount} applicant(s) to next round?`
                  : `Reject ${selectedCount} applicant(s)?`}
              </div>

              {showConfirm === 'reject' && (
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    id="bulkIsAbsent"
                    checked={isAbsent}
                    onChange={(e) => setIsAbsent(e.target.checked)}
                    className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="bulkIsAbsent" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Mark all absent
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowConfirm(null)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span className="bg-slate-100 text-slate-700 text-sm px-4 py-1.5 rounded-full font-semibold tracking-wide border border-slate-200/50">
              {selectedCount} selected
            </span>
            <span className="text-sm text-slate-700 font-medium">
              Ready for action
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowConfirm('next_round')}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
            >
              {isFinalRound ? 'Select All' : 'Next Round'}
            </button>
            <button
              onClick={() => setShowConfirm('reject')}
              disabled={loading}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={onClear}
              disabled={loading}
              className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}
