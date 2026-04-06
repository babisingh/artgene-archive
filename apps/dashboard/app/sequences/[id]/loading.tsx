export default function CertificateLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />

      {/* Summary card skeleton */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Gate skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-5 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
