import { cn } from "@/lib/cn";

/**
 * Bangla skeleton used by the exam and result routes while their server
 * components resolve. Deliberately static (no spinner) so it renders the same
 * on the server and the client with no hydration work.
 */
export function ExamLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 py-10", className)} role="status" aria-live="polite">
      <div className="mb-6 h-6 w-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        ))}
      </div>
      <p className="mt-6 text-center text-[0.8125rem] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
