"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, TriangleAlert, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { getBrowserClient } from "@/lib/supabase/browser";

const passwordChecks = [
  { test: (v: string) => v.length >= 8, label: "কমপক্ষে ৮ অক্ষর" },
  { test: (v: string) => /[a-zA-Z]/.test(v), label: "একটি অক্ষর" },
  { test: (v: string) => /[0-9]/.test(v), label: "একটি সংখ্যা" },
];

export function RegisterForm({ courses }: { courses: { slug: string; title: string }[] }) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    targetCourse: courses[0]?.slug ?? "bcs",
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.fullName.trim().length < 2) {
      setError("আপনার নাম লিখুন।");
      return;
    }
    if (!form.email.includes("@")) {
      setError("সঠিক ইমেইল ঠিকানা দিন।");
      return;
    }
    if (!passwordChecks.every((c) => c.test(form.password))) {
      setError("পাসওয়ার্ডের শর্তগুলো পূরণ করুন।");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          targetCourse: form.targetCourse,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        needsConfirmation?: boolean;
      };

      if (!response.ok) {
        setError(payload.error ?? "রেজিস্ট্রেশন সম্পন্ন হয়নি।");
        return;
      }

      if (payload.needsConfirmation) {
        setNeedsConfirmation(true);
        return;
      }

      const supabase = getBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (signInError) {
        router.push("/login");
        return;
      }
      router.replace("/dashboard?welcome=1");
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="mt-8 rounded-2xl border border-mint-100 bg-mint-50 p-5 dark:border-mint-600/30 dark:bg-mint-600/10">
        <CheckCircle2 className="size-6 text-mint-600 dark:text-mint-500" aria-hidden />
        <h2 className="mt-3 text-[1rem] font-semibold text-[var(--text)]">ইমেইল যাচাই করুন</h2>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          আমরা <strong className="text-[var(--text)]">{form.email}</strong>-এ একটি যাচাইকরণ লিংক পাঠিয়েছি।
          লিংকে ক্লিক করে তারপর লগইন করুন।
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex text-[0.8125rem] font-semibold text-[var(--brand)] hover:underline"
        >
          লগইন পেজে যান →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[0.8125rem] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      <Field label="পূর্ণ নাম" htmlFor="fullName" required>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          placeholder="আপনার নাম"
          value={form.fullName}
          onChange={set("fullName")}
        />
      </Field>

      <Field label="ইমেইল" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="মোবাইল" htmlFor="phone" hint="ঐচ্ছিক">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={form.phone}
            onChange={set("phone")}
          />
        </Field>

        <Field label="লক্ষ্য কোর্স" htmlFor="targetCourse">
          <Select id="targetCourse" name="targetCourse" value={form.targetCourse} onChange={set("targetCourse")}>
            {courses.map((course) => (
              <option key={course.slug} value={course.slug}>
                {course.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="পাসওয়ার্ড" htmlFor="password" required>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="কমপক্ষে ৮ অক্ষর"
            value={form.password}
            onChange={set("password")}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--text-subtle)] hover:text-[var(--text)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {passwordChecks.map((check) => {
            const passed = check.test(form.password);
            return (
              <span
                key={check.label}
                className={`inline-flex items-center gap-1 text-[0.6875rem] font-medium ${
                  passed ? "text-mint-600 dark:text-mint-500" : "text-[var(--text-subtle)]"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${passed ? "bg-mint-500" : "bg-[var(--border-strong)]"}`}
                  aria-hidden
                />
                {check.label}
              </span>
            );
          })}
        </div>
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {!loading ? <UserPlus className="size-4" aria-hidden /> : null}
        অ্যাকাউন্ট তৈরি করুন
      </Button>

      <p className="text-center text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
        রেজিস্ট্রেশন করলে আপনি আমাদের{" "}
        <Link href="/terms" className="underline hover:text-[var(--brand)]">
          শর্তাবলি
        </Link>{" "}
        ও{" "}
        <Link href="/privacy" className="underline hover:text-[var(--brand)]">
          প্রাইভেসি পলিসি
        </Link>{" "}
        মেনে নিচ্ছেন।
      </p>

      <p className="text-center text-[0.8125rem] text-[var(--text-muted)]">
        আগেই অ্যাকাউন্ট আছে?{" "}
        <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
          লগইন করুন
        </Link>
      </p>
    </form>
  );
}
