"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

/**
 * Root error boundary. Every other string in the app is curated Bangla copy, so
 * an unhandled server error must not drop the student onto Next's default grey
 * English page — especially mid-exam. Sits at the app root so it covers the
 * marketing site, the dashboard and /admin.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Keep the digest in the console so a support report can be traced to a log.
    console.error("[app] unhandled error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-[var(--text)]">কিছু একটা ভুল হয়েছে</h1>
      <p className="text-pretty text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
        অপ্রত্যাশিত একটি সমস্যা হয়েছে। আবার চেষ্টা করুন — সমস্যা থেকে গেলে কিছুক্ষণ পর ফিরে আসুন।
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-[var(--text-muted)]">ত্রুটি কোড: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <RotateCcw aria-hidden className="size-4" />
        আবার চেষ্টা করুন
      </button>
    </main>
  );
}
