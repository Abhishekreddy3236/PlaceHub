const statusThemes = {
  in_progress: {
    pill: 'bg-blue-50 text-blue-700 border-blue-200/80 ring-1 ring-blue-600/20',
    dot: 'bg-blue-600',
    icon: '●',
  },
  rejected: {
    pill: 'bg-red-600 text-white border-transparent',
    dot: 'bg-white',
    icon: '✕',
  },
  selected: {
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-600/20',
    dot: 'bg-emerald-600',
    icon: '✓',
  },
};

/**
 * Resolves the name of the current round from the job's rounds array.
 * Falls back to "Round N" if no match is found.
 */
const resolveRoundName = (rounds, roundNumber) => {
  if (!Array.isArray(rounds) || !rounds.length || !roundNumber) return null;
  const round = rounds.find((r) => r.order === roundNumber) || rounds[roundNumber - 1];
  return round?.name || null;
};

/**
 * StatusBadge — prominent application status pill with legible round progress details.
 */
export default function StatusBadge({
  status,
  currentRound,
  rounds,
  rejectedAtRound,
  showRoundDetail = false,
  showIcon = false,
  isAbsent = false,
}) {
  const normStatus = (status || '').toLowerCase();
  const theme = statusThemes[normStatus] || statusThemes.in_progress;

  const roundName = resolveRoundName(rounds, currentRound);
  const rejectedRoundName = rejectedAtRound
    ? resolveRoundName(rounds, rejectedAtRound)
    : null;
  const totalRounds = Array.isArray(rounds) ? rounds.length : 0;

  // Determine pill title
  let pillText = 'In Progress';
  if (normStatus === 'selected') pillText = 'Selected';
  else if (normStatus === 'rejected') pillText = isAbsent === true ? 'Rejected - Absent' : 'Rejected';
  else if (normStatus === 'in_progress') {
    if (!showRoundDetail && currentRound) {
      pillText = roundName ? `Round ${currentRound}: ${roundName}` : `Round ${currentRound}`;
    } else {
      pillText = 'In Progress';
    }
  } else {
    pillText = status || 'In Progress';
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs whitespace-nowrap ${theme.pill}`}
      >
        {showIcon && <span className="text-[10px] leading-none mr-1.5">{theme.icon}</span>}
        <span>{pillText}</span>
      </span>

      {showRoundDetail && (
        <>
          {normStatus === 'in_progress' && (
            <div className="text-xs font-medium text-slate-600 text-right max-w-[180px] sm:max-w-[240px] truncate">
              {totalRounds > 0
                ? `Round ${currentRound || 1} of ${totalRounds}${roundName ? ` — ${roundName}` : ''}`
                : roundName || `Round ${currentRound || 1}`}
            </div>
          )}

          {normStatus === 'rejected' && rejectedAtRound && (
            <div className="text-xs font-medium text-slate-600 text-right max-w-[180px] sm:max-w-[240px] truncate">
              Rejected • {rejectedRoundName || `Round ${rejectedAtRound}`}{isAbsent === true ? ' - Absent' : ''}
            </div>
          )}

          {normStatus === 'selected' && (
            <div className="text-xs font-medium text-emerald-600 text-right">
              All {totalRounds || ''} round{(totalRounds || 0) !== 1 ? 's' : ''} cleared
            </div>
          )}
        </>
      )}
    </div>
  );
}
