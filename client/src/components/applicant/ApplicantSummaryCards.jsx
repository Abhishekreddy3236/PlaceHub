import React, { memo } from 'react';
import { HiOutlineUsers, HiOutlineClock, HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi';

const getDividerClasses = (i) => {
  if (i === 0) return '';
  if (i === 1) return 'border-l border-slate-200';
  if (i === 2) return 'border-t sm:border-t-0 sm:border-l border-slate-200';
  if (i === 3) return 'border-t sm:border-t-0 border-l border-slate-200';
  return '';
};

function ApplicantSummaryCards({ counts, loading = false }) {
  const metrics = [
    {
      label: 'TOTAL',
      value: counts?.all ?? 0,
      icon: HiOutlineUsers,
      valueClass: 'text-slate-900',
      iconClass: 'text-slate-400',
    },
    {
      label: 'IN PROGRESS',
      value: counts?.in_progress ?? 0,
      icon: HiOutlineClock,
      valueClass: 'text-blue-600',
      iconClass: 'text-blue-500',
    },
    {
      label: 'SELECTED',
      value: counts?.selected ?? 0,
      icon: HiOutlineCheckCircle,
      valueClass: 'text-emerald-600',
      iconClass: 'text-emerald-500',
    },
    {
      label: 'REJECTED',
      value: counts?.rejected ?? 0,
      icon: HiOutlineXCircle,
      valueClass: 'text-red-600',
      iconClass: 'text-red-500',
    },
  ];

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`py-3 px-4 sm:py-3.5 sm:px-5 animate-pulse flex flex-col justify-center ${getDividerClasses(i)}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-3.5 h-3.5 bg-slate-200 rounded-full shrink-0"></div>
                <div className="h-2.5 w-20 bg-slate-200 rounded"></div>
              </div>
              <div className="h-8 w-20 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className={`py-3 px-4 sm:py-3.5 sm:px-5 flex flex-col justify-center transition-colors duration-150 hover:bg-slate-50/50 min-w-0 ${getDividerClasses(
                index
              )}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${metric.iconClass}`} />}
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 truncate">
                  {metric.label}
                </span>
              </div>
              <div className={`text-3xl font-bold leading-none tabular-nums whitespace-nowrap truncate ${metric.valueClass}`}>
                {Number(metric.value || 0).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ApplicantSummaryCards);
