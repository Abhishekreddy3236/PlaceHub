export default function PageSkeleton({ variant = 'cards', count = 6 }) {
  if (variant === 'route') {
    return (
      <div className="space-y-6 animate-pulse duration-1000 opacity-80 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-1/3 bg-slate-200 rounded-lg" />
            <div className="h-4 w-1/4 bg-slate-200 rounded-md" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="h-4 w-full bg-slate-200 rounded-md" />
          <div className="h-4 w-5/6 bg-slate-200 rounded-md" />
          <div className="h-4 w-4/6 bg-slate-200 rounded-md" />
          <div className="pt-4 mt-4 border-t border-slate-100 space-y-4">
            <div className="h-4 w-full bg-slate-200 rounded-md" />
            <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="space-y-8 animate-pulse duration-1000 opacity-80">
        <div className="space-y-3">
          <div className="h-8 w-64 bg-slate-200 rounded-lg" />
          <div className="h-4 w-80 bg-slate-200 rounded-lg" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-full">
              <div className="h-16 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col pointer-events-none">
              <div className="flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-4 mt-1">
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0 animate-pulse duration-1000 opacity-80" />
                    <div className="w-full">
                      <div className="h-5 w-2/3 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                      <div className="h-4 w-1/3 bg-slate-200 rounded mt-2 animate-pulse duration-1000 opacity-80" />
                    </div>
                  </div>
                  <div className="w-16 h-6 rounded-full bg-slate-200 shrink-0 animate-pulse duration-1000 opacity-80" />
                </div>

                <div className="flex items-center gap-4 mt-5">
                  <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                  <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
                  <div className="h-6 w-20 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
                  <div className="h-6 w-14 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3 animate-pulse duration-1000 opacity-80">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="h-5 w-1/3 bg-slate-200 rounded" />
            <div className="h-4 w-1/2 bg-slate-200 rounded" />
            <div className="h-4 w-2/3 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col pointer-events-none">
        <div className="flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-4 mt-1">
            <div className="flex items-start gap-3 w-full">
              <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0 animate-pulse duration-1000 opacity-80" />
              <div className="w-full">
                <div className="h-5 w-2/3 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                <div className="h-4 w-1/3 bg-slate-200 rounded mt-2 animate-pulse duration-1000 opacity-80" />
              </div>
            </div>
            <div className="w-16 h-6 rounded-full bg-slate-200 shrink-0 animate-pulse duration-1000 opacity-80" />
          </div>

          <div className="flex items-center gap-4 mt-5">
            <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
            <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
          </div>

          <div className="mt-4 space-y-2">
            <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
            <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200">
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
            <div className="h-6 w-20 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
            <div className="h-6 w-14 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col pointer-events-none">
          <div className="flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-4 mt-1">
              <div className="flex items-start gap-3 w-full">
                <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0 animate-pulse duration-1000 opacity-80" />
                <div className="w-full">
                  <div className="h-5 w-2/3 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                  <div className="h-4 w-1/3 bg-slate-200 rounded mt-2 animate-pulse duration-1000 opacity-80" />
                </div>
              </div>
              <div className="w-16 h-6 rounded-full bg-slate-200 shrink-0 animate-pulse duration-1000 opacity-80" />
            </div>

            <div className="flex items-center gap-4 mt-5">
              <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
              <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
              <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
              <div className="h-6 w-20 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
              <div className="h-6 w-14 bg-slate-200 rounded-md animate-pulse duration-1000 opacity-80" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
