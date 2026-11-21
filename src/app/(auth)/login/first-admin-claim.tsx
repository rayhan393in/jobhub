"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown on the sign-in screen only while the platform has no staff member.
 * The button calls the server, which re-checks the seat under a lock — this
 * component is a convenience, never the security boundary.
 */
export function FirstAdminClaim({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function claim() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/claim-admin", { method: "POST" });
      const payload = (await response.json()) as { error?: string; role?: string };
      if (!response.ok) {
        setError(payload.error ?? "অ্যাডমিন অ্যাক্সেস চালু করা যায়নি।");
        return;
      }
      setDone(true);
      router.refresh();
      router.push("/admin");
    } catch {
      setError("নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-mint-100 bg-mint-50 px-4 py-3.5 text-[0.8125rem] font-medium text-mint-700 dark:border-mint-600/30 dark:bg-mint-600/10 dark:text-mint-400">
        <ShieldCheck className="mb-1 size-4" aria-hidden />
        অ্যাডমিন অ্যাক্সেস চালু হয়েছে — অ্যাডমিন সেন্টারে নিয়ে যাচ্ছি…
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--text)]">
        <ShieldCheck className="size-4 text-[var(--brand)]" aria-hidden />
        প্রথম অ্যাডমিন সেটআপ
      </p>
      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
        এই প্ল্যাটফর্মে এখনো কোনো অ্যাডমিন নেই। আপনি যদি প্রতিষ্ঠানের দায়িত্বপ্রাপ্ত ব্যক্তি হন, তাহলে
        নিচের বাটন থেকে অ্যাডমিন অ্যাক্সেস চালু করুন। একজন অ্যাডমিন তৈরি হওয়ার পর এই সুযোগটি
        স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।
      </p>

      {error ? (
        <p className="mt-3 flex items-start gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]" role="alert">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {signedIn ? (
        <Button type="button" onClick={claim} loading={loading} size="sm" className="mt-3 w-full">
          <ShieldCheck className="size-3.5" aria-hidden />
          অ্যাডমিন অ্যাক্সেস চালু করুন
        </Button>
      ) : (
        <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
          আগে অ্যাকাউন্টে লগইন করুন, তারপর এই বাটনটি দেখা যাবে।
        </p>
      )}
    </div>
  );
}
