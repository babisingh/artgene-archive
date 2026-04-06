"use client";

import { useEffect } from "react";

export default function RegisterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Register page error:", error);
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-10 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Registration page failed to load
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error.message}</p>
        <button onClick={reset} className="btn-primary mx-auto">
          Try again
        </button>
      </div>
    </div>
  );
}
