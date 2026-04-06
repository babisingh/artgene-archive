"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function CertificateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Certificate page error:", error);
  }, [error]);

  return (
    <div className="card p-10 text-center space-y-4">
      <div className="text-4xl">🔍</div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        Certificate not found
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        {error.message}
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={reset} className="btn-secondary">
          Try again
        </button>
        <Link href="/sequences" className="btn-primary">
          ← Back to registry
        </Link>
      </div>
    </div>
  );
}
