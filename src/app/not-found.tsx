import Link from "next/link";

/**
 * 404 page. A mistyped or expired `/results/[attemptId]` link previously fell
 * through to Next's default English "could not be found" screen.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-[var(--brand)]">৪০৪</p>
      <h1 className="text-xl font-semibold text-[var(--text)]">পৃষ্ঠাটি পাওয়া যায়নি</h1>
      <p className="text-pretty text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
        লিংকটি হয়তো ভুল, অথবা কন্টেন্টটি সরিয়ে ফেলা হয়েছে।
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          ড্যাশবোর্ডে যান
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]"
        >
          হোম পেজ
        </Link>
      </div>
    </main>
  );
}
