export default function RegistryLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-9 w-44 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-8">
          {[100, 64, 80, 120, 64, 60, 80].map((w, i) => (
            <div key={i} className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
            {[100, 64, 80, 120, 64, 60, 80].map((w, j) => (
              <div key={j} className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
