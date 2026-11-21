import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const metadata: Metadata = {
  title: "অ্যাডমিন প্রবেশ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where an operator should land. `/admin/login` is the memorable address that
 * gets shared with staff; it forwards to the real sign-in form and back again.
 */
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && isStaff(user.role)) redirect("/admin");
  if (!user) redirect("/login?next=/admin");

  return (
    <div>
      <h1 className="text-[1.625rem] font-bold tracking-[-0.03em] text-[var(--text)]">অ্যাডমিন প্রবেশ</h1>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
        এই পেজটি শুধু স্টাফ অ্যাকাউন্টের জন্য।
      </p>

      <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[0.8125rem] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4" aria-hidden />
          অ্যাক্সেস নেই
        </p>
        <p className="mt-1.5">
          আপনি <strong className="font-semibold">{user.email}</strong> অ্যাকাউন্টে লগইন করেছেন, কিন্তু এই
          অ্যাকাউন্টে এখনো স্টাফ ভূমিকা (কনটেন্ট এডিটর / অ্যাডমিন) দেওয়া হয়নি। অ্যাক্সেস পেতে একজন
          বিদ্যমান অ্যাডমিনকে আপনার অ্যাকাউন্টটি চালু করতে বলুন।
        </p>
      </div>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex text-[0.8125rem] font-semibold text-[var(--brand)] hover:underline"
      >
        ← ছাত্র ড্যাশবোর্ডে ফিরে যান
      </Link>
    </div>
  );
}
