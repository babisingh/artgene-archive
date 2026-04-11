export default function RegisterLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="h-7 w-52 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-80 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5 h-64 animate-pulse bg-slate-50 dark:bg-slate-800" />
          <div className="card p-5 h-48 animate-pulse bg-slate-50 dark:bg-slate-800" />
        </div>
        <div className="card p-5 h-40 animate-pulse bg-slate-50 dark:bg-slate-800" />
      </div>
    </div>
  );
}
