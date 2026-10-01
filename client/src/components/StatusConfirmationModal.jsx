import { useState } from 'react';
import { HiExclamationTriangle } from 'react-icons/hi2';

const actionConfig = {
  promote: {
    label: 'Move to Next Round',
    bg: 'bg-blue-600',
    hoverBg: 'hover:bg-blue-700',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  reject: {
    label: 'Reject',
    bg: 'bg-red-600',
    hoverBg: 'hover:bg-red-700',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  // Legacy fallbacks
  Shortlisted: {
    label: 'Shortlist',
    bg: 'bg-blue-600',
    hoverBg: 'hover:bg-blue-700',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  Rejected: {
    label: 'Reject',
    bg: 'bg-red-600',
    hoverBg: 'hover:bg-red-700',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  Selected: {
    label: 'Select',
    bg: 'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-700',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
};

const defaultMessages = {
  promote: (name, roundName, nextRound) =>
    `Congratulations ${name}! You have been shortlisted and will move to the next round${nextRound ? ` (${nextRound})` : ''}.`,
  reject: (name, roundName) =>
    `Dear ${name}, we regret to inform you that your application has not been selected to move forward${roundName ? ` after ${roundName}` : ''}. We wish you all the best.`,
};

export default function StatusConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  candidateName,
  action,
  status,
  currentRound,
  roundName,
  nextRoundName,
  totalRounds,
  loading,
}) {
  const effectiveAction = action || status;
  const [isAbsent, setIsAbsent] = useState(false);

  if (!isOpen) return null;

  const config = actionConfig[effectiveAction] || {
    label: effectiveAction,
    bg: 'bg-blue-600',
    hoverBg: 'hover:bg-blue-700',
    iconBg: 'bg-yellow-50',
    iconColor: 'text-yellow-600',
  };

  const isPromote = effectiveAction === 'promote' || effectiveAction === 'Shortlisted';
  const isReject = effectiveAction === 'reject' || effectiveAction === 'Rejected';
  const willSelect = isPromote && currentRound && totalRounds && currentRound >= totalRounds;

  const getDescription = () => {
    if (willSelect) {
      return (
        <>
          This is the final round. <span className="text-slate-900 font-semibold">{candidateName}</span> will be
          marked as <span className="text-emerald-600 font-semibold">Selected.</span> This action cannot be undone.
        </>
      );
    }
    if (isPromote) {
      return (
        <>
          Move <span className="text-slate-900 font-semibold">{candidateName}</span> from{' '}
          <span className="font-semibold text-slate-800">{roundName || `Round ${currentRound}`}</span> to{' '}
          <span className="text-blue-600 font-semibold">{nextRoundName || `Round ${(currentRound || 1) + 1}`}</span>? This action cannot be undone.
        </>
      );
    }
    if (isReject) {
      return (
        <>
          Are you sure you want to reject <span className="text-slate-900 font-semibold">{candidateName}</span> at{' '}
          <span className="font-semibold text-slate-800">{roundName || `Round ${currentRound}`}</span>? This action cannot be undone.
        </>
      );
    }
    return (
      <>
        Update status for <span className="text-slate-900 font-semibold">{candidateName}</span> to{' '}
        <span className="text-slate-900 font-semibold">{effectiveAction}</span>?
      </>
    );
  };

  const handleConfirm = () => {
    onConfirm({ isAbsent });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[440px] bg-white border border-slate-200/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-full ${config.iconBg || 'bg-yellow-50'} flex items-center justify-center mb-4 ring-4 ring-white shadow-sm`}>
            <HiExclamationTriangle className={`w-6 h-6 ${config.iconColor || 'text-yellow-600'}`} />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-1.5 tracking-tight">
            {willSelect ? 'Confirm Selection' : `Confirm: ${config.label}`}
          </h3>
          <p className="text-slate-700 font-medium text-[15px] leading-relaxed px-2">{getDescription()}</p>
        </div>

        {isReject && (
          <div className="mt-5 flex items-center justify-center">
            <label htmlFor="isAbsent" className="flex items-center gap-2.5 cursor-pointer bg-slate-50/80 hover:bg-slate-100/80 px-3.5 py-2.5 rounded-xl border border-slate-200/60 transition-all">
              <input
                type="checkbox"
                id="isAbsent"
                checked={isAbsent}
                onChange={(e) => setIsAbsent(e.target.checked)}
                className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-offset-1 cursor-pointer transition-colors"
              />
              <span className="text-sm font-semibold text-slate-700">
                Mark as absent
              </span>
            </label>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 ${willSelect ? 'bg-emerald-600 hover:bg-emerald-700' : config.bg} ${willSelect ? '' : config.hoverBg} text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : willSelect ? (
              'Confirm Selection'
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
