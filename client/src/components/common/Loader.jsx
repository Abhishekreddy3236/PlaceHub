import React from 'react';

function Loader({ label = 'Loading', size = 'md', variant = 'spinner', rows = 5 }) {
  if (variant === 'table') {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="h-4 w-40 animate-pulse duration-1000 opacity-80 rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-5 gap-4 px-5 py-4">
              <div className="h-4 animate-pulse duration-1000 opacity-80 rounded bg-slate-200" />
              <div className="h-4 animate-pulse duration-1000 opacity-80 rounded bg-slate-200" />
              <div className="h-4 animate-pulse duration-1000 opacity-80 rounded bg-slate-200" />
              <div className="h-4 animate-pulse duration-1000 opacity-80 rounded bg-slate-200" />
              <div className="h-4 animate-pulse duration-1000 opacity-80 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-16 animate-pulse duration-1000 opacity-80 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse duration-1000 opacity-80 rounded-xl border border-slate-200 bg-white" />
          <div className="h-80 animate-pulse duration-1000 opacity-80 rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  const sizeClass = size === 'sm' ? 'h-4 w-4 border-2' : 'h-8 w-8 border-4';

  if (size === 'sm' && !label) {
    return (
      <span
        className={`${sizeClass} inline-block animate-spin rounded-full border-blue-600 border-t-transparent`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-600">
      <span
        className={`${sizeClass} animate-spin rounded-full border-blue-600 border-t-transparent`}
        aria-hidden="true"
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export default React.memo(Loader);
