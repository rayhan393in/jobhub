"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, TriangleAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown at the top of the dashboard while the platform still has no staff.
 * Claiming promotes the signed-in account to super_admin, once, under a lock in
 * the database — the button is the only thing this component owns.
 */
export function FirstAdminBanner() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [claimed, setClaimed] = React.useState(false);

  async function claim() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/claim-admin", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "অ্যাডমিন অ্যাক্সেস চালু করা যায়নি।");
        return;
      }
      setClaimed(true);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  if (claimed) {
    return (
      <div className="jh-card mb-6 border-mint-200 bg-mint-50 p-4 dark:border-mint-600/30 dark:bg-mint-600/10">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-mint-700 dark:text-mint-400">
          <ShieldCheck className="size-4" aria-hidden />
          অ্যাডমিন অ্যাক্সেস চালু হয়েছে
        </p>
        <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)]">
          আপনার অ্যাকাউন্টটি এখন সুপার অ্যাডমিন। অ্যাডমিন সেন্টারে যেতে উপরের মেনু ব্যবহার করুন।
        </p>
        <Button type="button" size="sm" className="mt-3" onClick={() => router.push("/admin")}>
          অ্যাডমিন সেন্টারে যান
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="jh-card mb-6 overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-l-4 border-[var(--brand)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.875rem] font-bold text-[var(--text)]">
            <ShieldCheck className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
            প্রথম অ্যাডমিন সেটআপ
          </p>
          <p className="mt-1 text-pretty text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            এই প্ল্যাটফর্মে এখনো কোনো অ্যাডমিন নেই। আপনি যদি প্রতিষ্ঠানের দায়িত্বপ্রাপ্ত ব্যক্তি হন,
            তাহলে এখনই এই অ্যাকাউন্টটিকে অ্যাডমিন করুন। একবার একজন অ্যাডমিন তৈরি হলে এই সুযোগ
            স্থায়ীভাবে বন্ধ হয়ে যাবে।
          </p>
          {error ? (
            <p className="mt-2 flex items-start gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]" role="alert">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={claim} loading={loading} className="shrink-0">
          <ShieldCheck className="size-4" aria-hidden />
          অ্যাডমিন বানুন
        </Button>
      </div>
    </div>
  );
}
