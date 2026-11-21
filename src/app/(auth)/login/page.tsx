import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { FirstAdminClaim } from "./first-admin-claim";
import { isFirstAdminSeatOpen } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "লগইন",
  description: "JobHub অ্যাকাউন্টে লগইন করে আপনার প্রস্তুতি চালিয়ে যান।",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Both lookups are needed on every render, so fetch them together.
  const [seatOpen, user] = await Promise.all([isFirstAdminSeatOpen(), getCurrentUser()]);
  return (
    <div>
      <h1 className="text-[1.625rem] font-bold tracking-[-0.03em] text-[var(--text)]">আবার স্বাগতম</h1>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
        আপনার অ্যাকাউন্টে লগইন করে অসম্পূর্ণ পরীক্ষা, রুটিন ও অগ্রগতি দেখুন।
      </p>
      <Suspense fallback={<div className="jh-skeleton mt-8 h-72 w-full" />}>
        <LoginForm />
      </Suspense>
      {seatOpen ? <FirstAdminClaim signedIn={Boolean(user)} /> : null}
    </div>
  );
}
